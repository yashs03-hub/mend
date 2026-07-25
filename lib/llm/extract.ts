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
      deltoidSensationLoss: { type: "boolean", description: "Numbness or loss of sensation over the lateral shoulder / deltoid muscle" },
      unableToElevateArm: { type: "boolean", description: "Cannot elevate, abduct, or lift the operated arm" },
    },
    additionalProperties: false,
  },
};

/** Splits on clause boundaries so a denial in one clause cannot suppress a symptom in another. */
function clausesOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[.;,!?]|\bbut\b|\bthough\b/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * A clause that denies. Detected per clause rather than per transcript, because
 * "no chest pain, but my calf is swollen" must suppress one and not the other.
 */
const NEGATION = /\b(no|not|never|without|haven'?t|hasn'?t|isn'?t|aren'?t|didn'?t|don'?t|doesn'?t|none|nothing|free of|denies)\b/;

/**
 * A clause that reports someone else's words rather than the patient's symptom:
 * advice they were given, a leaflet they read, a relative's illness. Naming a
 * symptom is not the same as having it.
 */
const HEARSAY =
  /\b(mentioned|asked about|leaflet|warned|watch(ing)? out for|look out for|told me to|read about|last (winter|year|month))\b/;

/**
 * A clause asserting that something is normal. Needed because a denial often
 * lands in a *different* clause from the body part it refers to — "my calf is
 * fine, no swelling" puts the reassurance first and the negation second, so
 * clause-level negation alone would still fire on the word "calf".
 */
const REASSURANCE =
  /\b(is|are|was|were|been|feels?|looks?|seems?)\s+(fine|ok|okay|alright|all right|normal|good|clean|dry|settled|better)\b/;

/** Inability is expressed *through* negation, so it is matched before suppression applies. */
const INABILITY =
  /\b(can'?t|cannot|can not|unable to|couldn'?t)\b[^.]{0,24}\b(put|stand|bear|weight|walk|step|elevate|lift|abduct|raise)\b/;

const PATTERNS: { key: keyof Symptoms; re: RegExp }[] = [
  { key: "breathless", re: /\b(breathless|short of breath|shortness of breath|out of puff|catch my breath|winded)\b/ },
  { key: "chestPain", re: /\bchest\b[^.]{0,20}\b(pain|hurts?|aches?|tight)\b|\b(pain|catch|tightness)\b[^.]{0,20}\bchest\b/ },
  { key: "calfPainOrSwelling", re: /\bcalf\b|\bback of my leg\b|\bleg\b[^.]{0,24}\b(swollen|puffy|tender|sore)\b/ },
  { key: "woundDischarge", re: /\b(discharge|oozing|weeping|pus|seeping)\b/ },
  { key: "feverSubjective", re: /\b(fever|feverish|shivery|chills|hot and cold)\b/ },
  { key: "suddenSevereHipPain", re: /\b(went pop|gave way|sudden severe pain|pain was (awful|terrible))\b/ },
  { key: "legShortenedOrRotated", re: /\b(shorter than|turned out|rotated)\b/ },
  { key: "newConfusion", re: /\b(confused|confusion|muddled|disoriented|not making sense)\b/ },
  { key: "deltoidSensationLoss", re: /\b(deltoid|shoulder|badge)\b[^.]{0,24}\b(sensation|feeling|numb|dead|cannot feel|can't feel)\b|\b(sensation|feeling|numb|dead|cannot feel|can't feel)\b[^.]{0,24}\b(deltoid|shoulder|badge)\b/ },
  { key: "unableToElevateArm", re: /\b(elevate|lift|abduct|raise)\b[^.]{0,24}\b(arm|shoulder)\b/ },
];

const PAIN_UNCONTROLLED = /\b(pain is bad|agony|unbearable|aren'?t helping|isn'?t helping|not helping|isn'?t touching|not touching)\b/;
const PAIN_CONTROLLED = /\b(pain is fine|quite manageable|manageable|nothing i can'?t handle|under control|not too bad)\b/;

/**
 * Keyword fallback used when no API key is configured, or when the API call
 * fails or is refused. It is not a substitute for the model — it is a floor
 * beneath it.
 *
 * Negation handling is the whole difficulty. A naive matcher scores "no chest
 * pain at all" as chest pain, and a false alarm on a well patient is how a
 * monitoring product loses a clinician permanently. Clause-level denial and
 * hearsay suppression are measured against data/extraction-corpus.jsonl —
 * see `npm run eval:data`.
 */
export function extractSymptomsHeuristic(transcript: string): Symptoms {
  const s: Symptoms = {};

  for (const clause of clausesOf(transcript)) {
    // Inability is asserted using negative words, so it is read before the
    // denial check would otherwise throw it away.
    if (INABILITY.test(clause)) {
      if (/\b(put|stand|bear|weight|walk|step)\b/.test(clause)) s.unableToWeightBear = true;
      if (/\b(elevate|lift|abduct|raise)\b/.test(clause)) s.unableToElevateArm = true;
    }

    if (NEGATION.test(clause) || HEARSAY.test(clause) || REASSURANCE.test(clause))
      continue;

    for (const { key, re } of PATTERNS) {
      if (re.test(clause)) (s[key] as boolean) = true;
    }
  }

  // Pain polarity is judged over the whole transcript: it is a summary
  // judgement rather than an event, and it is phrased with negatives on both
  // sides ("isn't helping" vs "nothing I can't handle").
  const t = transcript.toLowerCase();
  if (PAIN_UNCONTROLLED.test(t)) s.painControlled = false;
  else if (PAIN_CONTROLLED.test(t)) s.painControlled = true;

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
