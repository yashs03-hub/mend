import { NextResponse } from "next/server";
import { DEFAULT_PATIENT_FIRST_NAME, firstName } from "@/lib/clinical/scripts";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { lastCheckinSummary } from "@/lib/memory/last-checkin";
import { startCheckInCall, type StartCheckInCallResult } from "@/lib/telephony/call";

/**
 * POST /api/call — the button that makes the phone ring on stage.
 *
 * Loads the demo patient's identity + phone from Supabase (falling back to
 * `DEMO_PATIENT_PHONE` when the row has no phone on file, or Supabase is
 * unavailable entirely), pulls Task 14's one-sentence recall of the prior
 * check-in, and places the outbound ElevenLabs/Twilio call. Never throws:
 * every failure mode maps to a typed JSON response.
 */

const DEFAULT_DAY_POST_OP = 4;

interface CallRequestBody {
  dayPostOp?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Never throws — an empty or malformed body is treated as "use defaults",
 * since this route is triggered by a plain button click with no required
 * payload. */
function parseBody(raw: unknown): CallRequestBody {
  if (!isPlainObject(raw)) {
    return {};
  }
  if (typeof raw.dayPostOp === "number" && Number.isFinite(raw.dayPostOp)) {
    return { dayPostOp: raw.dayPostOp };
  }
  return {};
}

interface CallPatientContext {
  patientId: string | undefined;
  patientName: string;
  phone: string | undefined;
}

async function loadCallPatient(): Promise<CallPatientContext> {
  const fallback: CallPatientContext = {
    patientId: undefined,
    patientName: DEFAULT_PATIENT_FIRST_NAME,
    phone: undefined,
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[api/call] Supabase client unavailable — using fallback patient identity.");
    return fallback;
  }

  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) {
      console.warn("[api/call] demo patient not found — using fallback patient identity.");
      return fallback;
    }
    return { patientId: patient.id, patientName: firstName(patient.name), phone: patient.phone };
  } catch (err) {
    console.warn("[api/call] Supabase read failed — using fallback patient identity.", err);
    return fallback;
  }
}

function statusCodeFor(result: StartCheckInCallResult): number {
  switch (result.status) {
    case "sent":
      return 200;
    case "skipped":
      return 503;
    case "error":
      return 502;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const body = parseBody(raw);
  const dayPostOp = body.dayPostOp ?? DEFAULT_DAY_POST_OP;

  const { patientId, patientName, phone } = await loadCallPatient();
  const toNumber = phone || process.env.DEMO_PATIENT_PHONE;

  if (!toNumber) {
    console.warn(
      "[api/call] No destination phone number available (patient row has none on file and DEMO_PATIENT_PHONE is unset).",
    );
    return NextResponse.json(
      { status: "error", reason: "No destination phone number configured." },
      { status: 400 },
    );
  }

  const summary = patientId ? await lastCheckinSummary(patientId) : "";

  const result = await startCheckInCall({
    name: patientName,
    phone: toNumber,
    dayPostOp,
    lastCheckinSummary: summary,
  });

  return NextResponse.json(result, { status: statusCodeFor(result) });
}
