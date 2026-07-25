import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { DEFAULT_PATIENT_FIRST_NAME, firstName, scriptForDecision } from "@/lib/clinical/scripts";
import type { Symptoms } from "@/lib/clinical/types";
import { getSupabaseClient } from "@/lib/db/supabase";
import { fetchDemoPatient, fetchLatestEcg, fetchLatestVitals } from "@/lib/db/queries";
import { loadActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioVitals } from "@/lib/sim/fixtures";

/**
 * POST /api/triage — the ElevenLabs webhook tool.
 *
 * This is the architectural centrepiece: a live voice agent, mid-phone-call
 * with the patient, calls this endpoint as a tool. It hands over the
 * structured symptoms it just heard; this route runs the deterministic
 * `evaluate()` engine and hands back the exact sentence the agent must
 * speak. The model reads out a decision it did not make and could not
 * override — no Claude call sits anywhere on this path, and `severity`
 * can only ever be a value `evaluate()` itself produced.
 *
 * LATENCY: the agent is mid-conversation with a live human. Every
 * Supabase read below is timeout-guarded (lib/db/queries.ts) and falls
 * back to fixtures rather than ever letting a slow/unreachable database
 * turn into dead air on the call.
 */

const WEBHOOK_SECRET_HEADER = "x-triage-webhook-secret";

/** Matches the seeded demo patient (lib/db/schema.sql: surgery_date =
 * current_date - 4) and the worked example in the task brief itself
 * ("post-op day 4"), so an agent that omits `dayPostOp` still gets a
 * clinically sensible default rather than an arbitrary one. */
const DEFAULT_DAY_POST_OP = 4;

/**
 * Constant-time comparison of the request's webhook secret against
 * `TRIAGE_WEBHOOK_SECRET`. A plain `===` on a secret leaks timing
 * information proportional to how many leading bytes match, which is a
 * real (if slow) oracle for guessing the secret — `crypto.timingSafeEqual`
 * avoids that, but only compares buffers of EQUAL length (it throws
 * otherwise), so the length check must happen first. That early return on
 * a length mismatch is itself safe: it leaks only the *length* of the
 * secret, never anything about its content, and the secret's length is not
 * treated as sensitive here.
 *
 * Fails closed (returns false) when `TRIAGE_WEBHOOK_SECRET` is not
 * configured at all — an unconfigured secret must never be treated as "no
 * auth required".
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.TRIAGE_WEBHOOK_SECRET;
  if (!expected) {
    return false;
  }

  const provided = request.headers.get(WEBHOOK_SECRET_HEADER) ?? "";
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

interface TriageRequestBody {
  symptoms: Symptoms;
  dayPostOp?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Mirrors the field-by-field validation lib/llm/extract.ts applies to
 * Claude's tool output. Duplicated rather than imported so this
 * latency-critical route has zero coupling to the LLM module boundary —
 * this file must remain trivially auditable as "no Claude anywhere in this
 * path" without having to trace an import graph to prove it.
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

function sanitizeSymptoms(raw: Record<string, unknown>): Symptoms {
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

/** Returns undefined on ANY malformed shape — never throws. `symptoms`
 * must be present and an object; `dayPostOp`, if present, must be a finite
 * number. */
function parseBody(raw: unknown): TriageRequestBody | undefined {
  if (!isPlainObject(raw) || !isPlainObject(raw.symptoms)) {
    return undefined;
  }

  if (raw.dayPostOp !== undefined && (typeof raw.dayPostOp !== "number" || !Number.isFinite(raw.dayPostOp))) {
    return undefined;
  }

  return {
    symptoms: sanitizeSymptoms(raw.symptoms),
    dayPostOp: raw.dayPostOp as number | undefined,
  };
}

interface LatestReadings {
  patientFirstName: string;
  vitals: ReturnType<typeof scenarioVitals>;
  ecg: ReturnType<typeof scenarioEcg>;
}

/** Loads the latest vitals + ECG for the demo patient, falling back to
 * fixtures whenever Supabase is unavailable, unreachable, slow, or simply
 * has no rows yet for that patient — "empty" is treated the same as
 * "absent" per the task brief, not as an error. Never throws. */
async function loadLatestReadings(): Promise<LatestReadings> {
  const now = new Date();
  const fallbackScenario = await loadActiveScenario();
  const fallback: LatestReadings = {
    patientFirstName: DEFAULT_PATIENT_FIRST_NAME,
    vitals: scenarioVitals(fallbackScenario, now),
    ecg: scenarioEcg(fallbackScenario),
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[api/triage] Supabase client unavailable — using fixture vitals/ECG.");
    return fallback;
  }

  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) {
      console.warn("[api/triage] demo patient not found in Supabase — using fixture vitals/ECG.");
      return fallback;
    }

    const [vitals, ecg] = await Promise.all([
      fetchLatestVitals(supabase, patient.id),
      fetchLatestEcg(supabase, patient.id),
    ]);

    return {
      patientFirstName: firstName(patient.name),
      vitals: vitals ?? fallback.vitals,
      ecg: ecg ?? fallback.ecg,
    };
  } catch (err) {
    console.warn("[api/triage] Supabase read failed — using fixture vitals/ECG.", err);
    return fallback;
  }
}

/**
 * Speakable line for tool-call failures mid-phone-call. Kept deliberately
 * non-clinical: no fabricated severity, US care-team wording only. HTTP
 * status stays 4xx so logs/metrics still see a real failure; the agent
 * needs `script` so it has something safe to say instead of improvising.
 */
const TOOL_ERROR_SCRIPT =
  "I'm having trouble reaching the care team system right now, so I can't " +
  "complete a clinical assessment on this call. Please contact your care " +
  "team or nurse line today, or call 911 if you feel you are in danger or " +
  "your symptoms are getting worse.";

function errorResponse(status: 400 | 401, error: string): NextResponse {
  return NextResponse.json({ error, script: TOOL_ERROR_SCRIPT }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return errorResponse(401, "Unauthorized");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "Malformed JSON body.");
  }

  const body = parseBody(raw);
  if (!body) {
    return errorResponse(400, "Expected { symptoms: Symptoms, dayPostOp?: number }.");
  }

  const dayPostOp = body.dayPostOp ?? DEFAULT_DAY_POST_OP;
  const { patientFirstName, vitals, ecg } = await loadLatestReadings();

  const decision = evaluate({ dayPostOp, symptoms: body.symptoms, vitals, ecg });
  const script = scriptForDecision(decision, patientFirstName);

  return NextResponse.json({
    severity: decision.level,
    ...(decision.condition ? { condition: decision.condition } : {}),
    script,
    reason: decision.rationale.join(" "),
  });
}
