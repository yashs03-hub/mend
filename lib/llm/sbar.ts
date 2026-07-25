import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, getAnthropicModel } from "./client";
import type { Decision, EcgReading, Symptoms, TrendFinding, VitalsReading } from "../clinical/types";

const MAX_WORDS = 120;
const ECG_SOURCE_LABEL = "KardiaMobile 6L";

export interface GenerateSbarArgs {
  patient: string;
  dayPostOp: number;
  procedure: string;
  decision: Decision;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  trendFindings: TrendFinding[];
  /** Injected for tests; omit to use the real client from client.ts. */
  client?: Anthropic | null;
  model?: string;
}

const SYSTEM_PROMPT =
  "You write a concise clinical SBAR (Situation, Background, Assessment, Recommendation) " +
  "handoff for a post-operative recovery patient to relay to their own care team. Use ONLY " +
  "the facts given to you below — never invent, infer, or add any symptom, vital sign, ECG " +
  "finding, or recommendation that is not explicitly present in the input. The assessment " +
  "level and the recommended action have already been clinically determined by a separate " +
  "deterministic system; state them verbatim and do not soften, escalate, second-guess, or " +
  `add your own severity judgement. Keep the entire SBAR to ${MAX_WORDS} words or fewer. When ` +
  `an ECG reading is present, refer to its source as "${ECG_SOURCE_LABEL}", never a generic term.`;

/**
 * Generates prose SBAR text from already-decided clinical facts. Never
 * decides severity or escalation itself — `decision` (the output of
 * `evaluate()` in red-flag-engine.ts) is passed through and must be used
 * verbatim, not re-derived or reinterpreted.
 *
 * Degrades gracefully: with no Anthropic client available this logs a
 * warning and returns a plain deterministic SBAR built directly from the
 * structured facts (no LLM prose, but nothing invented either), so the
 * patient still gets a usable handoff without an API key.
 */
export async function generateSbar(args: GenerateSbarArgs): Promise<string> {
  const client = args.client !== undefined ? args.client : createAnthropicClient();
  if (!client) {
    console.warn("[llm] generateSbar: no Anthropic client available — returning a deterministic fallback SBAR.");
    return buildFallbackSbar(args);
  }

  const model = args.model ?? getAnthropicModel();
  const message = await client.messages.create({
    model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildFactsPrompt(args) }],
  });

  return parseSbarMessage(message, args);
}

/** Pure, network-free: renders the facts Claude is allowed to use into a
 * plain-text block. Exported for testing prompt construction without a
 * network call. */
export function buildFactsPrompt(args: GenerateSbarArgs): string {
  const lines: string[] = [
    `Patient: ${args.patient}`,
    `Procedure: ${args.procedure}`,
    `Day post-op: ${args.dayPostOp}`,
    "",
    "Decision (already determined — state verbatim, do not reassess):",
    `  Level: ${args.decision.level}`,
    ...(args.decision.condition ? [`  Condition: ${args.decision.condition}`] : []),
    `  Recommended action: ${args.decision.action}`,
    ...(args.decision.call ? [`  Recommended contact: ${args.decision.call}`] : []),
    `  Rationale: ${args.decision.rationale.join(" ")}`,
    "",
    "Vitals:",
    `  ${formatVitals(args.vitals)}`,
    "",
    `Reported symptoms: ${formatSymptoms(args.symptoms)}`,
  ];

  if (args.ecg) {
    lines.push(
      "",
      `ECG (${ECG_SOURCE_LABEL}): determination=${args.ecg.determination}${
        args.ecg.bpm !== undefined ? `, bpm=${args.ecg.bpm}` : ""
      }, recordedAt=${args.ecg.recordedAt}`,
    );
  }

  if (args.trendFindings && args.trendFindings.length > 0) {
    lines.push(
      "",
      "Trend findings (trajectory over recent readings):",
      ...args.trendFindings.map((f) => `  - ${f.description}`),
    );
  }

  lines.push(
    "",
    "Write the SBAR now, using only the facts above.",
  );

  return lines.join("\n");
}

function formatVitals(vitals: VitalsReading): string {
  const parts: string[] = [];
  if (vitals.hr !== undefined) parts.push(`HR ${vitals.hr} bpm`);
  if (vitals.sbp !== undefined && vitals.dbp !== undefined) {
    parts.push(`BP ${vitals.sbp}/${vitals.dbp} mmHg`);
  } else if (vitals.sbp !== undefined) {
    parts.push(`SBP ${vitals.sbp} mmHg`);
  }
  if (vitals.tempC !== undefined) parts.push(`Temp ${vitals.tempC}\u00B0C`);
  if (vitals.spo2 !== undefined) parts.push(`SpO2 ${vitals.spo2}%`);
  if (vitals.respRate !== undefined) parts.push(`RR ${vitals.respRate}/min`);
  parts.push(`quality: ${vitals.quality}`);
  return parts.length > 1 ? parts.join(", ") : `No usable vitals reading (quality: ${vitals.quality}).`;
}

const SYMPTOM_LABELS: Record<Exclude<keyof Symptoms, "painScore">, string> = {
  breathless: "breathless",
  chestPain: "chest pain",
  calfPainOrSwelling: "calf pain or swelling",
  woundDischarge: "wound discharge",
  feverSubjective: "subjectively feverish",
  suddenSevereHipPain: "sudden severe hip pain",
  legShortenedOrRotated: "leg shortened or rotated",
  unableToWeightBear: "unable to weight-bear",
  painControlled: "pain controlled",
  newConfusion: "new confusion",
};

function formatSymptoms(symptoms: Symptoms): string {
  const reported: string[] = [];

  for (const key of Object.keys(SYMPTEM_LABELS_LOCAL) as Array<keyof typeof SYMPTEM_LABELS_LOCAL>) {
    const value = symptoms[key];
    if (value === true) {
      reported.push(SYMPTEM_LABELS_LOCAL[key]);
    } else if (key === "painControlled" && value === false) {
      reported.push("pain NOT controlled");
    }
  }

  if (symptoms.painScore !== undefined) {
    reported.push(`pain score ${symptoms.painScore}/10`);
  }

  return reported.length > 0 ? reported.join(", ") : "none reported";
}

const SYMPTEM_LABELS_LOCAL: Record<Exclude<keyof Symptoms, "painScore">, string> = {
  breathless: "breathless",
  chestPain: "chest pain",
  calfPainOrSwelling: "calf pain or swelling",
  woundDischarge: "wound discharge",
  feverSubjective: "subjectively feverish",
  suddenSevereHipPain: "sudden severe hip pain",
  legShortenedOrRotated: "leg shortened or rotated",
  unableToWeightBear: "unable to weight-bear",
  painControlled: "pain controlled",
  newConfusion: "new confusion",
};

/** Pure, network-free: extracts text from a Message and enforces the
 * 120-word cap as a formatting safety net (not a clinical judgement — the
 * cap is on word count only, and truncation never touches which facts were
 * already stated). Exported for testing against recorded fixture
 * messages. */
export function parseSbarMessage(message: Anthropic.Message, args: GenerateSbarArgs): string {
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (text.length === 0) {
    return buildFallbackSbar(args);
  }

  return enforceWordCap(text, MAX_WORDS);
}

function enforceWordCap(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(" ") + "\u2026";
}

/**
 * Deterministic fallback used only when Claude is unavailable. Built
 * entirely from already-decided structured facts (Decision, vitals,
 * symptoms) — it states them, it does not judge them, so this remains
 * faithful to "LLMs at the edges, a deterministic core" even without an
 * LLM in the loop.
 */
export function buildFallbackSbar(args: GenerateSbarArgs): string {
  const conditionPart = args.decision.condition ? ` (${args.decision.condition})` : "";
  const ecgPart = args.ecg
    ? ` ${ECG_SOURCE_LABEL} ECG: ${args.ecg.determination}${args.ecg.bpm !== undefined ? ` at ${args.ecg.bpm} bpm` : ""}.`
    : "";
  const trendPart =
    args.trendFindings && args.trendFindings.length > 0
      ? ` Trends: ${args.trendFindings.map((f) => f.description).join(" ")}`
      : "";

  const text =
    `S: ${args.patient}, day ${args.dayPostOp} after ${args.procedure}, status ${args.decision.level}${conditionPart}. ` +
    `B: Reported symptoms: ${formatSymptoms(args.symptoms)}. Vitals: ${formatVitals(args.vitals)}.${ecgPart}${trendPart} ` +
    `A: ${args.decision.rationale.join(" ")} ` +
    `R: ${args.decision.action}`;

  return enforceWordCap(text, MAX_WORDS);
}
