import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";

/**
 * POST /api/vitals — accepts a single `VitalsReading` (see
 * lib/clinical/types.ts) and persists it to the `vitals` table.
 *
 * This is the landing point for `app/components/BleHeartRate.tsx`'s live
 * Bluetooth heart rate stream, but the shape is source-agnostic: anything
 * that can produce a `VitalsReading` (manual entry, the KardiaMobile flow,
 * the simulator) can POST here unchanged. `source` on the body is what
 * distinguishes them, not the endpoint.
 *
 * Mirrors app/api/ecg/route.ts's persistence posture: never throws on a
 * missing/unreachable Supabase, and always answers with the validated
 * reading plus whether it was actually written.
 */

const VitalsSourceSchema = z.enum(["ble_heart_rate", "manual", "kardia_6l", "simulated"]);
const QualitySchema = z.enum(["ok", "poor", "stale"]);

const VitalsReadingSchema = z.object({
  timestamp: z
    .string()
    .min(1, "timestamp must be a non-empty string")
    .refine((s) => !Number.isNaN(Date.parse(s)), "timestamp must be a parseable date string"),
  hr: z.number().finite().optional(),
  sbp: z.number().finite().optional(),
  dbp: z.number().finite().optional(),
  tempC: z.number().finite().optional(),
  spo2: z.number().finite().optional(),
  respRate: z.number().finite().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  source: VitalsSourceSchema,
  deviceLabel: z.string().optional(),
  quality: QualitySchema,
});

/** `patientId` is not part of the clinical `VitalsReading` shape (which
 * knows nothing about persistence) — it rides alongside it in the request
 * body, exactly as app/api/ecg/route.ts accepts an optional `patientId`
 * form field. Omitted, it falls back to the seeded demo patient. */
const RequestBodySchema = VitalsReadingSchema.extend({
  patientId: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vitals reading.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { patientId: requestedPatientId, ...reading } = parsed.data;

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[api/vitals] Supabase client unavailable — returning the reading without persisting it.");
    return NextResponse.json({ reading, persisted: false });
  }

  const patientId = requestedPatientId ?? (await fetchDemoPatient(supabase))?.id;
  if (!patientId) {
    console.warn("[api/vitals] no patient id available (none supplied and demo patient not found) — skipping persistence.");
    return NextResponse.json({ reading, persisted: false });
  }

  const { error } = await supabase.from("vitals").insert({
    patient_id: patientId,
    recorded_at: reading.timestamp,
    hr: reading.hr ?? null,
    sbp: reading.sbp ?? null,
    dbp: reading.dbp ?? null,
    temp_c: reading.tempC ?? null,
    spo2: reading.spo2 ?? null,
    resp_rate: reading.respRate ?? null,
    pain_score: reading.painScore ?? null,
    source: reading.source,
    device_label: reading.deviceLabel ?? null,
    quality: reading.quality,
  });

  if (error) {
    console.warn("[api/vitals] failed to persist vitals reading:", error.message);
    return NextResponse.json({ reading, persisted: false });
  }

  return NextResponse.json({ reading, persisted: true });
}
