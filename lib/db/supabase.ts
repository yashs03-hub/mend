import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Decision, Symptoms, VitalsReading } from "@/lib/clinical/types";

/**
 * Persistence is best-effort by design. Storing a check-in is useful, but a
 * storage outage must never stop a patient being told to call 911 — so every
 * failure here is swallowed and reported, not thrown.
 */

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key);
  return cached;
}

export interface CheckinRecord {
  dayPostOp: number;
  transcript?: string;
  symptoms: Symptoms;
  vitals: VitalsReading;
  decision: Decision;
  sbar?: string;
}

/** Returns a short status string for the UI rather than throwing. */
export async function persistCheckin(r: CheckinRecord): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return "not configured";
  try {
    const { error } = await supabase.from("checkins").insert({
      day_post_op: r.dayPostOp,
      transcript: r.transcript ?? null,
      symptoms: r.symptoms,
      vitals: r.vitals,
      decision: r.decision,
      sbar: r.sbar ?? null,
    });
    return error ? `failed: ${error.message}` : "saved";
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : "unknown"}`;
  }
}
