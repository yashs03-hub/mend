import Anthropic from "@anthropic-ai/sdk";
import { Decision, Symptoms, VitalsReading } from "@/lib/clinical/types";

/**
 * Writes the clinician handoff. This is the LLM at the *other* edge: the
 * verdict is already fixed by the time we get here, so the model is only
 * choosing words for facts the engine established. It cannot change the level,
 * and the rationale it is given is quoted from the rules that actually fired.
 */

const MODEL = "claude-opus-5";

export interface SbarArgs {
  patient: string;
  dayPostOp: number;
  procedure: string;
  decision: Decision;
  symptoms: Symptoms;
  vitals: VitalsReading;
}

/**
 * Deterministic SBAR, used when no API key is set or the call fails. Less
 * fluent than the model's version, but it contains exactly the same facts —
 * which is the point: the content comes from the engine either way.
 */
export function composeSbarDeterministic(a: SbarArgs): string {
  const v = a.vitals;
  const obs = [
    v.hr !== undefined ? `HR ${v.hr}` : null,
    v.sbp !== undefined && v.dbp !== undefined ? `BP ${v.sbp}/${v.dbp}` : null,
    v.tempC !== undefined ? `Temp ${v.tempC} C` : null,
    v.ecgFlags?.length ? `ECG ${v.ecgFlags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const reported = Object.entries(a.symptoms)
    .filter(([, val]) => val !== undefined)
    .map(([k, val]) =>
      k === "painControlled"
        ? val
          ? "pain controlled"
          : "pain NOT controlled"
        : val
          ? humanise(k)
          : null,
    )
    .filter(Boolean)
    .join(", ");

  return [
    `S: ${a.patient}, day ${a.dayPostOp} after ${a.procedure}, at home. ${
      a.decision.condition ?? "Routine check-in"
    }.`,
    `B: Discharged home and enrolled in daily remote check-ins. Reported today: ${reported || "no specific symptoms"}.`,
    `A: ${obs || "No usable vitals this check-in"}. ${a.decision.rationale.join("; ")}.`,
    `R: ${a.decision.action}`,
  ].join("\n");
}

function humanise(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();
}

export interface SbarResult {
  text: string;
  source: "model" | "deterministic";
  note?: string;
}

export async function generateSbar(a: SbarArgs): Promise<SbarResult> {
  const fallback = composeSbarDeterministic(a);

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      text: fallback,
      source: "deterministic",
      note: "ANTHROPIC_API_KEY not set — using deterministic SBAR",
    };
  }

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low" },
      system:
        "You write concise clinical SBAR handoffs (Situation, Background, Assessment, " +
        "Recommendation) for a post-operative orthopaedic patient at home, to be read by " +
        "their care team. Use ONLY the decision, symptoms and vitals provided — never " +
        "invent a finding, a measurement, or a history. Do not change the escalation " +
        "level: it has already been determined by a clinical rules engine and is not " +
        "yours to revise. Four labelled lines, 120 words maximum, no preamble.",
      messages: [{ role: "user", content: JSON.stringify(a, null, 2) }],
    });

    if (res.stop_reason === "refusal") {
      return {
        text: fallback,
        source: "deterministic",
        note: "Model declined — using deterministic SBAR",
      };
    }

    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (!text) {
      return {
        text: fallback,
        source: "deterministic",
        note: "Empty model response — using deterministic SBAR",
      };
    }

    return { text, source: "model" };
  } catch (err) {
    return {
      text: fallback,
      source: "deterministic",
      note: `SBAR generation failed (${err instanceof Error ? err.message : "unknown"}) — using deterministic SBAR`,
    };
  }
}
