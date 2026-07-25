import { NextResponse } from "next/server";
import { extractSymptoms } from "@/lib/llm/extract";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { generateSbar } from "@/lib/llm/sbar";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { scenarioVitals, Scenario } from "@/lib/sim/vitals-feed";
import { persistCheckin, fetchCheckins } from "@/lib/db/supabase";

export const runtime = "nodejs";

/**
 * One check-in: transcript in, decision out.
 *
 *   transcript ──▶ Claude ──▶ symptoms ──┐
 *                                        ├──▶ evaluate() ──▶ decision ──▶ Claude ──▶ SBAR
 *   scenario   ──▶ vitals feed ──────────┘     (deterministic)
 *
 * Note the shape: both LLM calls sit either side of evaluate(), never inside it.
 */
export async function POST(req: Request) {
  let body: {
    transcript?: string;
    dayPostOp?: number;
    scenario?: string;
    procedure?: "hip" | "latarjet";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.transcript !== "string" || body.transcript.trim() === "") {
    return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
  }

  if (body.dayPostOp !== undefined && (typeof body.dayPostOp !== "number" || !Number.isFinite(body.dayPostOp))) {
    return NextResponse.json({ error: "dayPostOp must be a valid number" }, { status: 400 });
  }

  const dayPostOp = body.dayPostOp !== undefined ? Number(body.dayPostOp) : 4;
  const scenario: Scenario =
    body.scenario === "pe" || body.scenario === "fever" ? body.scenario : "green";
  const transcript = body.transcript;
  const procedure = body.procedure === "latarjet" ? "latarjet" : "hip";

  const extraction = await extractSymptoms(transcript);
  const vitals = scenarioVitals(scenario, new Date().toISOString());

  const checkins = await fetchCheckins();
  const history = checkins.map((c) => ({
    tempC: c.vitals?.tempC,
    dayPostOp: c.day_post_op,
  }));

  // The only line in this file that decides anything clinical.
  const decision = evaluate({
    dayPostOp,
    symptoms: extraction.symptoms,
    vitals,
    procedure,
    history,
    symptomsUnusable: !extraction.ok,
  });
  const phase = getPhase(dayPostOp, procedure);

  // A handoff is only generated when there is something to hand off. Green
  // check-ins deliberately produce no clinician note — that restraint is what
  // keeps the amber/red ones worth reading.
  const sbar =
    decision.level === "green"
      ? undefined
      : await generateSbar({
          patient: "Margaret W. (synthetic)",
          dayPostOp,
          procedure: procedure === "latarjet" ? "left shoulder Latarjet" : "right hip hemiarthroplasty",
          decision,
          symptoms: extraction.symptoms,
          vitals,
          trendFindings: [],
        });

  const storage = await persistCheckin({
    dayPostOp,
    transcript,
    symptoms: extraction.symptoms,
    vitals,
    decision,
    sbar: sbar,
  });

  return NextResponse.json({
    decision,
    phase,
    vitals,
    symptoms: extraction.symptoms,
    sbar: sbar,
    meta: {
      extractionSource: extraction.source,
      extractionNote: extraction.note,
      storage,
    },
  });
}
