import { NextRequest, NextResponse } from "next/server";
import { extractSymptoms } from "@/lib/llm/extract";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { generateSbar } from "@/lib/llm/sbar";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { scenarioVitals, Scenario } from "@/lib/sim/vitals-feed";
import { persistCheckin } from "@/lib/db/supabase";

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
export async function POST(req: NextRequest) {
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

  const dayPostOp = Number.isFinite(body.dayPostOp) ? Number(body.dayPostOp) : 4;
  const scenario: Scenario =
    body.scenario === "pe" || body.scenario === "fever" ? body.scenario : "green";
  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  const procedure = body.procedure === "latarjet" ? "latarjet" : "hip";

  const extraction = await extractSymptoms(transcript);
  const vitals = scenarioVitals(scenario, new Date().toISOString());

  // The only line in this file that decides anything clinical.
  const decision = evaluate({ dayPostOp, symptoms: extraction.symptoms, vitals, procedure });
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
        });

  const storage = await persistCheckin({
    dayPostOp,
    transcript,
    symptoms: extraction.symptoms,
    vitals,
    decision,
    sbar: sbar?.text,
  });

  return NextResponse.json({
    decision,
    phase,
    vitals,
    symptoms: extraction.symptoms,
    sbar: sbar?.text,
    meta: {
      extractionSource: extraction.source,
      extractionNote: extraction.note,
      sbarSource: sbar?.source,
      sbarNote: sbar?.note,
      storage,
    },
  });
}
