import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CheckinInsert,
  CheckinRow,
  Database,
  EcgReadingRow,
  EscalationInsert,
  VitalsInsert,
  VitalsRow,
} from "./supabase";
import type {
  EcgDetermination,
  EcgReading,
  VitalsReading,
  VitalsSource,
} from "../clinical/types";

/**
 * Shared, hot-path-safe Supabase reads/writes for the /api/triage and
 * /api/checkin routes. Every read here is wrapped in `withTimeout` and
 * every caller treats `undefined`/`[]` as "no usable data" rather than an
 * error — per constraint #2 (latency: never let a slow database stall a
 * live voice call) and constraint #6 (must still answer with no Supabase
 * credentials at all), nothing in this file may throw or hang its caller.
 */

export const DEMO_PATIENT_NAME = "Margaret (demo, synthetic)";

/**
 * Hard cap on any single Supabase round trip from a request handler. Two
 * sequential reads (patient lookup, then vitals+ECG in parallel) at this
 * cap is at most ~1.6s worst case — comfortably inside the 3s budget for
 * /api/triage — and a single lost/slow connection degrades to the fixture
 * fallback instead of hanging the response.
 */
const QUERY_TIMEOUT_MS = 800;

async function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T | undefined> {
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } catch {
    return undefined;
  }
}

export interface DemoPatient {
  id: string;
  name: string;
  procedure: string;
  surgeryDate: string;
  /** Undefined when the column is null — no destination number on file for
   * this row. Callers (app/api/call) fall back to `DEMO_PATIENT_PHONE`. */
  phone: string | undefined;
  /** Undefined when the column is null. Callers (app/api/checkin) fall back
   * to `DEMO_CAREGIVER_PHONE`. */
  caregiverPhone: string | undefined;
}

export async function fetchDemoPatient(
  supabase: SupabaseClient<Database>,
): Promise<DemoPatient | undefined> {
  const result = await withTimeout(
    supabase
      .from("patients")
      .select("id, name, procedure, surgery_date, phone, caregiver_phone")
      .eq("name", DEMO_PATIENT_NAME)
      .limit(1)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }

  return {
    id: result.data.id,
    name: result.data.name,
    procedure: result.data.procedure,
    surgeryDate: result.data.surgery_date,
    phone: result.data.phone ?? undefined,
    caregiverPhone: result.data.caregiver_phone ?? undefined,
  };
}

const VITALS_SOURCES: readonly VitalsSource[] = [
  "ble_heart_rate",
  "manual",
  "kardia_6l",
  "simulated",
];

function toVitalsSource(raw: string): VitalsSource {
  return (VITALS_SOURCES as readonly string[]).includes(raw) ? (raw as VitalsSource) : "manual";
}

function toQuality(raw: string): VitalsReading["quality"] {
  return raw === "ok" || raw === "poor" || raw === "stale" ? raw : "poor";
}

/** Defensively re-validates a database row into a `VitalsReading` — a raw
 * row is untrusted `unknown`-shaped data at the type level even though the
 * schema constrains it, mirroring the same discipline lib/llm/extract.ts
 * applies to Claude's tool output. */
function rowToVitalsReading(row: VitalsRow): VitalsReading {
  return {
    timestamp: row.recorded_at,
    ...(row.hr !== null ? { hr: row.hr } : {}),
    ...(row.sbp !== null ? { sbp: row.sbp } : {}),
    ...(row.dbp !== null ? { dbp: row.dbp } : {}),
    ...(row.temp_c !== null ? { tempC: row.temp_c } : {}),
    ...(row.spo2 !== null ? { spo2: row.spo2 } : {}),
    ...(row.resp_rate !== null ? { respRate: row.resp_rate } : {}),
    ...(row.pain_score !== null ? { painScore: row.pain_score } : {}),
    source: toVitalsSource(row.source),
    ...(row.device_label !== null ? { deviceLabel: row.device_label } : {}),
    quality: toQuality(row.quality),
  };
}

export async function fetchLatestVitals(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<VitalsReading | undefined> {
  const result = await withTimeout(
    supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }
  return rowToVitalsReading(result.data);
}

/**
 * Trailing vitals history for the trend engine, oldest-first (matching
 * lib/sim/fixtures.ts's scenarioHistory ordering — evaluateTrends itself
 * re-sorts defensively, but callers should not rely on that).
 */
export async function fetchVitalsHistory(
  supabase: SupabaseClient<Database>,
  patientId: string,
  limit = 14,
): Promise<VitalsReading[]> {
  const result = await withTimeout(
    supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(limit),
    QUERY_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return [];
  }
  return result.data.map(rowToVitalsReading).reverse();
}

const ECG_DETERMINATIONS: readonly EcgDetermination[] = [
  "normal_sinus_rhythm",
  "atrial_fibrillation",
  "tachycardia",
  "bradycardia",
  "unclassified",
];

function toEcgDetermination(raw: string): EcgDetermination {
  return (ECG_DETERMINATIONS as readonly string[]).includes(raw)
    ? (raw as EcgDetermination)
    : "unclassified";
}

function rowToEcgReading(row: EcgReadingRow): EcgReading {
  return {
    recordedAt: row.recorded_at,
    determination: toEcgDetermination(row.determination),
    ...(row.bpm !== null ? { bpm: row.bpm } : {}),
    source: "kardia_6l",
    ...(row.pdf_url !== null ? { pdfUrl: row.pdf_url } : {}),
  };
}

export async function fetchLatestEcg(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<EcgReading | undefined> {
  const result = await withTimeout(
    supabase
      .from("ecg_readings")
      .select("*")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }
  return rowToEcgReading(result.data);
}

/**
 * The patient's single most recent check-in row, for lib/memory/last-checkin.ts
 * to build the next call's recall opener from. Returns `undefined` on "no
 * prior check-in" (a brand-new patient) exactly the same way it does on
 * "Supabase unavailable" — both mean the agent falls back to its default
 * greeting, never an error.
 */
export async function fetchLatestCheckin(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<CheckinRow | undefined> {
  const result = await withTimeout(
    supabase
      .from("checkins")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    QUERY_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }
  return result.data;
}

/** Persistence timeout is more generous than the read timeout: writes
 * happen only on /api/checkin (never on the latency-critical /api/triage
 * hot path) and a slow write should still be given a fair chance to
 * complete before the route gives up and merely logs a warning. */
const WRITE_TIMEOUT_MS = 2500;

export async function insertCheckin(
  supabase: SupabaseClient<Database>,
  insert: CheckinInsert,
): Promise<string | undefined> {
  const result = await withTimeout(
    supabase.from("checkins").insert(insert).select("id").single(),
    WRITE_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }
  return result.data.id;
}

/** Persists one vitals reading, including optional per-row pain_score so
 * the trend engine can regress pain across distinct timepoints. */
export async function insertVitals(
  supabase: SupabaseClient<Database>,
  insert: VitalsInsert,
): Promise<void> {
  await withTimeout(supabase.from("vitals").insert(insert), WRITE_TIMEOUT_MS);
}

export async function insertEscalation(
  supabase: SupabaseClient<Database>,
  insert: EscalationInsert,
): Promise<string | undefined> {
  const result = await withTimeout(
    supabase.from("escalations").insert(insert).select("id").single(),
    WRITE_TIMEOUT_MS,
  );

  if (!result || result.error || !result.data) {
    return undefined;
  }
  return result.data.id;
}

/** Patches checkin_id onto an early caregiver-SMS audit row once the
 * check-in write has succeeded. Returns false on timeout, throw, or
 * Supabase error so callers can log — never throw, and never use a
 * link-back miss to suppress a successful SMS. */
export async function linkEscalationCheckin(
  supabase: SupabaseClient<Database>,
  escalationId: string,
  checkinId: string,
): Promise<boolean> {
  const result = await withTimeout(
    supabase.from("escalations").update({ checkin_id: checkinId }).eq("id", escalationId),
    WRITE_TIMEOUT_MS,
  );

  if (!result || result.error) {
    return false;
  }
  return true;
}
