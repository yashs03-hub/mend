import type { VitalsReading } from "@/lib/clinical/types";
import type { VitalsInsert } from "@/lib/db/supabase";

/**
 * Maps a check-in's physiologic snapshot + resolved pain score onto a
 * vitals insert row. `recordedAt` must be a fresh write-time stamp so
 * successive check-ins that reuse the same latest reading do not collide
 * on the trend engine's time axis.
 */
export function buildCheckinVitalsInsert(
  vitals: VitalsReading,
  painScore: number | null,
  recordedAt: string,
): Omit<VitalsInsert, "patient_id" | "id"> {
  return {
    recorded_at: recordedAt,
    hr: vitals.hr ?? null,
    sbp: vitals.sbp ?? null,
    dbp: vitals.dbp ?? null,
    temp_c: vitals.tempC ?? null,
    spo2: vitals.spo2 ?? null,
    resp_rate: vitals.respRate ?? null,
    pain_score: painScore,
    source: vitals.source,
    device_label: vitals.deviceLabel ?? null,
    quality: vitals.quality,
  };
}
