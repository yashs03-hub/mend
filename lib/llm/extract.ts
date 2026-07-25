import Anthropic from "@anthropic-ai/sdk";
import { Symptoms } from "@/lib/clinical/types";

/**
 * Turns free speech into structured symptoms. This is the LLM at the edge of
 * the system: it may decide what the patient *said*, never what it *means*.
 * The returned object goes straight into evaluate(), which owns the verdict.
 */

const MODEL = "claude-opus-5";

const SYMPTOM_TOOL = {
  name: "report_symptoms",
  description:
    "Record structured post-operative symptoms from the patient's own words. " +
    "Set a field true only if the patient clearly stated it. Set painControlled " +
    "false only if they said their pain is not controlled. Leave a field out if " +
    "it was not mentioned — omission means 'not reported', not 'denied'. " +
    "Do NOT assess severity, do NOT diagnose, and do NOT give advice.",
  input_schema: {
    type: "object" as const,
    properties: {
      breathless: { type: "boolean", description: "Short of breath / breathless" },
      chestPain: { type: "boolean", description: "Chest pain, especially on breathing in" },
      calfPainOrSwelling: { type: "boolean", description: "Calf pain, tenderness or swelling" },
      woundDischarge: { type: "boolean", description: "Discharge, pus or oozing from the wound" },
      feverSubjective: { type: "boolean", description: "Feeling feverish, hot or shivery" },
      suddenSevereHipPain: { type: "boolean", description: "Sudden severe pain in the operated hip" },
      legShortenedOrRotated: { type: "boolean", description: "Operated leg looks shorter or turned out" },
      unableToWeightBear: { type: "boolean", description: "Cannot put weight on the operated leg" },
      painControlled: { type: "boolean", description: "true if pain is controlled, false if not" },
      newConfusion: { type: "boolean", description: "New confusion or disorientation" },
    },
    additionalProperties: false,
  },
};

/**
 * Keyword fallback used when no API key is configured, or when the API call
 * fails or is refused. Deliberately over-inclusive: in this system a false
 * positive costs a phone call, while a false negative costs a missed embolism.
 * It is not a substitute for the model — it is a floor beneath it.
 */
export function extractSymptomsHeuristic(transcript: string): Symptoms {
  const t = transcript.toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => t.includes(n));
  const s: Symptoms = {};

  if (has("breath", "puff", "winded", "can't breathe", "cant breathe")) s.breathless = true;
  if (has("chest pain", "chest hurt", "pain in my chest", "catch in my chest")) s.chestPain = true;
  if (has("calf", "leg swollen", "swollen leg", "leg is swollen")) s.calfPainOrSwelling = true;
  if (has("discharge", "oozing", "pus", "weeping", "leaking")) s.woundDischarge = true;
  if (has("fever", "feverish", "shivery", "chills", "hot and cold")) s.feverSubjective = true;
  if (has("sudden severe", "gave way", "popped", "went pop")) s.suddenSevereHipPain = true;
  if (has("shorter", "turned out", "rotated")) s.legShortenedOrRotated = true;
  if (has("can't stand", "cant stand", "can't weight", "cannot bear", "can't put weight"))
    s.unableToWeightBear = true;
  if (has("confused", "muddled", "disoriented", "not making sense")) s.newConfusion = true;

  if (has("pain is bad", "agony", "unbearable", "not helping", "pain relief isn't"))
    s.painControlled = false;
  else if (has("pain is fine", "manageable", "not too bad", "under control"))
    s.painControlled = true;

  return s;
}

export interface ExtractionResult {
  symptoms: Symptoms;
  /** How the symptoms were derived — surfaced in the UI so nothing is silently degraded. */
  source: "model" | "heuristic";
  note?: string;
}

export async function extractSymptoms(
  transcript: string,
): Promise<ExtractionResult> {
  const text = (transcript ?? "").trim();
  if (!text) return { symptoms: {}, source: "heuristic", note: "Empty transcript" };

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      symptoms: extractSymptomsHeuristic(text),
      source: "heuristic",
      note: "ANTHROPIC_API_KEY not set — using keyword fallback",
    };
  }

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      // Thinking is on by default on Opus 5 and shares this budget with the
      // response, so max_tokens has to leave room for both or the forced tool
      // call gets truncated. Effort is low because this is a mechanical
      // extraction, not a reasoning task.
      max_tokens: 2048,
      output_config: { effort: "low" },
      tools: [SYMPTOM_TOOL],
      tool_choice: { type: "tool", name: "report_symptoms" },
      system:
        "You extract structured symptoms from post-operative check-in calls. " +
        "You never diagnose, never assess urgency, and never give medical advice. " +
        "A separate deterministic system decides what the symptoms mean.",
      messages: [
        {
          role: "user",
          content: `Patient check-in transcript:\n"""${text}"""`,
        },
      ],
    });

    // Opus 5 runs safety classifiers that can decline a request; check this
    // before reading content, which is empty or partial on a refusal.
    if (res.stop_reason === "refusal") {
      return {
        symptoms: extractSymptomsHeuristic(text),
        source: "heuristic",
        note: "Model declined the request — using keyword fallback",
      };
    }

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || !("input" in block)) {
      return {
        symptoms: extractSymptomsHeuristic(text),
        source: "heuristic",
        note: "No structured output returned — using keyword fallback",
      };
    }

    return { symptoms: block.input as Symptoms, source: "model" };
  } catch (err) {
    // Never let a network or quota failure block a check-in: a degraded
    // extraction that still reaches the safety engine beats no check-in at all.
    return {
      symptoms: extractSymptomsHeuristic(text),
      source: "heuristic",
      note: `Extraction failed (${err instanceof Error ? err.message : "unknown"}) — using keyword fallback`,
    };
  }
}
