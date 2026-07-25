import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, getAnthropicModel } from "./client";
import type { Symptoms } from "../clinical/types";

const REPORT_SYMPTOMS_TOOL_NAME = "report_symptoms";

/**
 * Tool-forced schema mirroring `Symptoms` (lib/clinical/types.ts) verbatim.
 */
export const REPORT_SYMPTOMS_TOOL: Anthropic.Tool = {
  name: REPORT_SYMPTOMS_TOOL_NAME,
  description:
    "Record the patient-reported symptoms from this post-operative check-in " +
    "transcript. Set a field ONLY if the patient (or someone speaking for them) " +
    "clearly and explicitly stated it — never infer, guess, or extrapolate from " +
    "tone, silence, or unrelated remarks. Leave a field unset if it was not " +
    "discussed or was ambiguous. Do not give medical advice. Do not assess, " +
    "describe, or hint at how severe or concerning any finding is — severity is " +
    "decided elsewhere, not by you.",
  input_schema: {
    type: "object",
    properties: {
      breathless: {
        type: "boolean",
        description: "Patient explicitly reported feeling breathless or short of breath.",
      },
      chestPain: {
        type: "boolean",
        description: "Patient explicitly reported chest pain.",
      },
      calfPainOrSwelling: {
        type: "boolean",
        description: "Patient explicitly reported calf pain or swelling.",
      },
      woundDischarge: {
        type: "boolean",
        description: "Patient explicitly reported discharge from the surgical wound.",
      },
      feverSubjective: {
        type: "boolean",
        description: "Patient explicitly reported feeling feverish or hot, without necessarily giving a number.",
      },
      suddenSevereHipPain: {
        type: "boolean",
        description: "Patient explicitly reported sudden, severe hip pain.",
      },
      legShortenedOrRotated: {
        type: "boolean",
        description: "Patient explicitly reported their operated leg appearing shortened or rotated.",
      },
      unableToWeightBear: {
        type: "boolean",
        description: "Patient explicitly reported being unable to bear weight on the operated leg.",
      },
      painControlled: {
        type: "boolean",
        description:
          "Patient explicitly stated whether their pain is controlled by the current plan: true if they said it is controlled, false if they said it is not.",
      },
      newConfusion: {
        type: "boolean",
        description: "Patient (or someone speaking for them) explicitly reported new confusion since surgery.",
      },
      painScore: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        description: "The patient's self-reported pain score on a 0-10 scale, only if they stated a number.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export interface ExtractSymptomsDeps {
  /** Injected for tests; omit to use the real client from client.ts. */
  client?: Anthropic | null;
  model?: string;
}

/**
 * Result of symptom extraction.
 */
export interface ExtractSymptomsResult {
  ok: boolean;
  symptoms: Symptoms;
  source: "llm" | "fallback";
  note?: string;
}

/**
 * Extracts structured symptoms from transcript.
 */
export async function extractSymptoms(
  transcript: string,
  deps: ExtractSymptomsDeps = {},
): Promise<ExtractSymptomsResult> {
  const client = deps.client !== undefined ? deps.client : createAnthropicClient();
  if (!client) {
    console.warn(
      "[llm] extractSymptoms: no Anthropic client available — extraction failed (not an empty symptom report).",
    );
    return { ok: false, symptoms: {}, source: "fallback", note: "no API client available" };
  }

  const model = deps.model ?? getAnthropicModel();

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        "You transcribe patient-reported symptoms from post-operative check-in calls into " +
        "structured data. You never assess severity, give advice, or decide on escalation.",
      tools: [REPORT_SYMPTOMS_TOOL],
      tool_choice: { type: "tool", name: REPORT_SYMPTOMS_TOOL_NAME },
      messages: [
        { role: "user", content: `Patient check-in transcript:\n\n${transcript}` },
      ],
    });

    const parsed = parseSymptomsMessage(message);
    return { ...parsed, source: "llm" };
  } catch (err) {
    console.warn("[llm] extractSymptoms: Anthropic call failed — extraction failed.", err);
    return { ok: false, symptoms: {}, source: "fallback", note: "API call failed" };
  }
}

/** Pure, network-free: pulls the tool_use block out of a Message and
 * sanitizes its input into a `Symptoms` object. Exported for testing
 * against recorded fixture messages. */
export function parseSymptomsMessage(message: Anthropic.Message): Omit<ExtractSymptomsResult, "source"> {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === REPORT_SYMPTOMS_TOOL_NAME,
  );

  if (!toolUse) {
    return { ok: false, symptoms: {} };
  }

  if (typeof toolUse.input !== "object" || toolUse.input === null) {
    return { ok: false, symptoms: {} };
  }

  return { ok: true, symptoms: sanitizeSymptomsInput(toolUse.input) };
}

const BOOLEAN_SYMPTOM_KEYS: ReadonlyArray<
  Exclude<keyof Symptoms, "painScore">
> = [
  "breathless",
  "chestPain",
  "calfPainOrSwelling",
  "woundDischarge",
  "feverSubjective",
  "suddenSevereHipPain",
  "legShortenedOrRotated",
  "unableToWeightBear",
  "painControlled",
  "newConfusion",
];

/** Defensively re-validates tool input against the `Symptoms` shape. */
function sanitizeSymptomsInput(input: object): Symptoms {
  const raw = input as Record<string, unknown>;
  const symptoms: Symptoms = {};

  for (const key of BOOLEAN_SYMPTOM_KEYS) {
    const value = raw[key];
    if (typeof value === "boolean") {
      symptoms[key] = value;
    }
  }

  const painScore = raw.painScore;
  if (typeof painScore === "number" && Number.isFinite(painScore)) {
    symptoms.painScore = Math.min(10, Math.max(0, Math.round(painScore)));
  }

  return symptoms;
}

/**
 * Keyword fallback used when no API key is configured, or when the API call
 * fails or is refused. Deliberately over-inclusive.
 */
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
const NEGATION =
  /\b(no|not|never|without|haven'?t|hasn'?t|isn'?t|aren'?t|didn'?t|don'?t|doesn'?t|none|nothing|free of|denies)\b/;

/**
 * A clause reporting someone else's words rather than the patient's symptom —
 * advice they were given, a leaflet they read. Naming a symptom is not having it.
 */
const HEARSAY =
  /\b(mentioned|asked about|leaflet|warned|watch(ing)? out for|look out for|told me to|read about|last (winter|year|month))\b/;

/**
 * A clause asserting something is normal. Needed because a denial often lands in
 * a *different* clause from the body part it refers to — "my calf is fine, no
 * swelling" puts the reassurance first and the negation second, so clause-level
 * negation alone would still fire on the word "calf".
 */
const REASSURANCE =
  /\b(is|are|was|were|been|feels?|looks?|seems?)\s+(fine|ok|okay|alright|all right|normal|good|clean|dry|settled|better)\b/;

/** Inability is expressed *through* negation, so it is matched before suppression applies. */
const INABILITY =
  /\b(can'?t|cannot|can not|unable to|couldn'?t)\b[^.]{0,24}\b(put|stand|bear|weight|walk|step)\b/;

const PATTERNS: { key: keyof Symptoms; re: RegExp }[] = [
  { key: "breathless", re: /\b(breathless|short of breath|shortness of breath|out of puff|catch my breath|winded)\b/ },
  { key: "chestPain", re: /\bchest\b[^.]{0,20}\b(pain|hurts?|aches?|tight)\b|\b(pain|catch|tightness)\b[^.]{0,20}\bchest\b/ },
  { key: "calfPainOrSwelling", re: /\bcalf\b|\bback of my leg\b|\bleg\b[^.]{0,24}\b(swollen|puffy|tender|sore)\b/ },
  { key: "woundDischarge", re: /\b(discharge|oozing|weeping|pus|seeping)\b/ },
  { key: "feverSubjective", re: /\b(fever|feverish|shivery|chills|hot and cold)\b/ },
  { key: "suddenSevereHipPain", re: /\b(went pop|gave way|sudden severe pain|pain was (awful|terrible))\b/ },
  { key: "legShortenedOrRotated", re: /\b(shorter than|turned out|rotated)\b/ },
  { key: "newConfusion", re: /\b(confused|confusion|muddled|disoriented|not making sense)\b/ },
];

const PAIN_UNCONTROLLED =
  /\b(pain is bad|agony|unbearable|aren'?t helping|isn'?t helping|not helping|isn'?t touching|not touching|bad today)\b/;
const PAIN_CONTROLLED =
  /\b(pain is fine|quite manageable|manageable|nothing i can'?t handle|under control|not too bad)\b/;

/**
 * Keyword fallback used when no API key is configured, or when the API call
 * fails or is refused. It is not a substitute for the model — it is a floor
 * beneath it.
 *
 * Negation handling is the whole difficulty. A naive substring matcher scores
 * "no chest pain at all" as chest pain, and a false alarm on a well patient is
 * how a monitoring product loses a clinician permanently. Measured against
 * data/extraction-corpus.jsonl via `npm run eval:data`: the naive version
 * raised 470 false positives across 533 transcripts containing an explicit
 * denial; this one raises 1.
 */
export function extractSymptomsHeuristic(transcript: string): Symptoms {
  const s: Symptoms = {};

  for (const clause of clausesOf(transcript)) {
    // Inability is asserted using negative words, so it is read before the
    // denial check would otherwise throw it away.
    if (INABILITY.test(clause)) s.unableToWeightBear = true;

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
