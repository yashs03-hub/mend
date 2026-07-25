import type { CheckinRow } from "../db/supabase";
import { getSupabaseClient } from "../db/supabase";
import { fetchLatestCheckin } from "../db/queries";
import type { Severity, Symptoms } from "../clinical/types";

/**
 * Conversational memory (Task 14): the one sentence the outbound call agent
 * opens with, recalling the patient's prior check-in. Consumed as the
 * `last_checkin_summary` dynamic variable in Task 13's call payload.
 *
 * `formatLastCheckinSummary` below is a PURE function — no I/O, no LLM —
 * of already-decided structured facts (`Symptoms`, a decision level, a
 * timestamp). `lastCheckinSummary` is the only impure part: it reads one
 * row from Supabase and hands it to the pure formatter.
 */

const BOOLEAN_SYMPTOM_KEYS: ReadonlyArray<Exclude<keyof Symptoms, "painScore">> = [
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

/** Defensively re-validates the jsonb `symptoms` column back into a
 * `Symptoms` shape, mirroring the re-validation discipline in
 * lib/db/queries.ts — a jsonb column is untrusted `unknown` at the type
 * level even though the schema constrains it. */
function toSymptoms(raw: unknown): Symptoms {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const symptoms: Symptoms = {};

  for (const key of BOOLEAN_SYMPTOM_KEYS) {
    const value = record[key];
    if (typeof value === "boolean") {
      symptoms[key] = value;
    }
  }

  const painScore = record.painScore;
  if (typeof painScore === "number" && Number.isFinite(painScore)) {
    symptoms.painScore = painScore;
  }

  return symptoms;
}

const SEVERITIES: readonly Severity[] = ["green", "amber", "red"];

function toSeverity(raw: unknown): Severity | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const level = (raw as Record<string, unknown>).level;
  return typeof level === "string" && (SEVERITIES as readonly string[]).includes(level)
    ? (level as Severity)
    : undefined;
}

export interface LastCheckinFacts {
  createdAt: string;
  symptoms: Symptoms;
  decisionLevel: Severity | undefined;
}

/** Pure, network-free: narrows a raw `CheckinRow`'s jsonb columns into the
 * typed facts the formatter reads. Exported for testing against
 * hand-built rows without a database. */
export function rowToLastCheckinFacts(row: CheckinRow): LastCheckinFacts {
  return {
    createdAt: row.created_at,
    symptoms: toSymptoms(row.symptoms),
    decisionLevel: toSeverity(row.decision),
  };
}

function timeLabel(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((now.getTime() - created.getTime()) / msPerDay);

  if (Number.isNaN(diffDays) || diffDays <= 0) {
    return "Earlier today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return `${diffDays} days ago`;
}

function joinClauses(clauses: readonly string[]): string {
  if (clauses.length <= 1) {
    return clauses.join("");
  }
  return `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
}

/** Shared clause list for patient-facing ("your") and family-facing ("her")
 * recall. Empty when there is nothing worth saying — callers must omit. */
function recallClauses(facts: LastCheckinFacts, painPossessive: "your" | "her"): string[] {
  const clauses: string[] = [];

  if (typeof facts.symptoms.painScore === "number") {
    clauses.push(`rated ${painPossessive} pain ${facts.symptoms.painScore} out of 10`);
  }
  if (facts.symptoms.breathless === true) {
    clauses.push("reported feeling breathless");
  } else if (facts.symptoms.breathless === false) {
    clauses.push("reported no breathlessness");
  }
  if (facts.symptoms.chestPain === true) {
    clauses.push("reported chest pain");
  }
  if (facts.symptoms.calfPainOrSwelling === true) {
    clauses.push("reported calf pain or swelling");
  }
  if (facts.symptoms.woundDischarge === true) {
    clauses.push("reported wound discharge");
  }
  if (facts.symptoms.newConfusion === true) {
    clauses.push("reported some new confusion");
  }

  if (clauses.length === 0) {
    if (facts.decisionLevel === "green") {
      clauses.push("said everything looked fine");
    } else if (facts.decisionLevel === "amber" || facts.decisionLevel === "red") {
      clauses.push("flagged some concerns that needed follow-up");
    }
  }

  return clauses;
}

/**
 * PURE. Builds the one-sentence recall opener from a prior check-in's
 * already-decided structured facts, e.g. "Yesterday you rated your pain 7
 * out of 10 and reported no breathlessness." Never calls an LLM.
 *
 * Returns an empty string when `facts` is undefined (no prior check-in —
 * the agent falls back to its default greeting) and also when a prior
 * check-in exists but carries nothing worth recalling (no symptoms and no
 * decision level), which can only happen for a malformed row.
 */
export function formatLastCheckinSummary(facts: LastCheckinFacts | undefined, now: Date = new Date()): string {
  if (!facts) {
    return "";
  }

  const clauses = recallClauses(facts, "your");
  if (clauses.length === 0) {
    return "";
  }

  return `${timeLabel(facts.createdAt, now)} you ${joinClauses(clauses)}.`;
}

/**
 * PURE. Family-facing third-person recall of a prior check-in's structured
 * facts, e.g. "Yesterday she rated her pain 4 out of 10 and reported no
 * breathlessness." Never invents a commitment or follow-up the patient did
 * not record — returns "" when there is nothing real to say, and the
 * family surface omits the sentence.
 *
 * Note: there is no stored "she said she'd ring them after lunch" fact in
 * the check-in row. That old hardcoded line is gone; this only speaks facts
 * the engine already recorded (symptoms / decision level).
 */
export function formatFamilyRecall(facts: LastCheckinFacts | undefined, now: Date = new Date()): string {
  if (!facts) {
    return "";
  }

  const clauses = recallClauses(facts, "her");
  if (clauses.length === 0) {
    return "";
  }

  return `${timeLabel(facts.createdAt, now)} she ${joinClauses(clauses)}.`;
}

/**
 * Reads the patient's most recent check-in and formats the recall opener.
 * Returns "" (never throws) whenever there is no prior check-in OR
 * persistence is unavailable/unreachable — the agent then uses its default
 * greeting instead of treating this as an error.
 */
export async function lastCheckinSummary(patientId: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[memory] Supabase client unavailable — no prior check-in recall for this call.");
    return "";
  }

  try {
    const row = await fetchLatestCheckin(supabase, patientId);
    if (!row) {
      return "";
    }
    return formatLastCheckinSummary(rowToLastCheckinFacts(row));
  } catch (err) {
    console.warn("[memory] failed to load the last check-in — no prior check-in recall for this call.", err);
    return "";
  }
}

/**
 * Family-view counterpart of `lastCheckinSummary`: same read, third-person
 * wording. Returns "" (never throws) when there is no prior check-in or
 * persistence is unavailable — the family surface omits the sentence.
 */
export async function familyRecallSummary(patientId: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[memory] Supabase client unavailable — no family recall sentence.");
    return "";
  }

  try {
    const row = await fetchLatestCheckin(supabase, patientId);
    if (!row) {
      return "";
    }
    return formatFamilyRecall(rowToLastCheckinFacts(row));
  } catch (err) {
    console.warn("[memory] failed to load the last check-in — no family recall sentence.", err);
    return "";
  }
}
