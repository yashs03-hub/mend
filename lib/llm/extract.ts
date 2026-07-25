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
      deltoidSensationLoss: {
        type: "boolean",
        description: "Patient explicitly reported loss of sensation over their deltoid muscle.",
      },
      unableToElevateArm: {
        type: "boolean",
        description: "Patient explicitly reported being unable to elevate or lift their arm.",
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
  "deltoidSensationLoss",
  "unableToElevateArm",
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
  if (has("deltoid", "numb")) s.deltoidSensationLoss = true;
  if (has("elevate my arm", "raise my shoulder", "elevate arm", "raise arm", "lift arm", "lift my arm")) s.unableToElevateArm = true;

  if (has("pain is bad", "agony", "unbearable", "not helping", "pain relief isn't", "bad today"))
    s.painControlled = false;
  else if (has("pain is fine", "manageable", "not too bad", "under control", "alright"))
    s.painControlled = true;

  return s;
}
