import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Decision, Symptoms, VitalsReading } from "@/lib/clinical/types";

/**
 * Row/insert shapes mirroring lib/db/schema.sql verbatim.
 */
export type PatientRow = {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone: string | null;
  caregiver_phone: string | null;
};

export type PatientInsert = {
  id?: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone?: string | null;
  caregiver_phone?: string | null;
};

export type VitalsRow = {
  id: string;
  patient_id: string;
  recorded_at: string;
  hr: number | null;
  sbp: number | null;
  dbp: number | null;
  temp_c: number | null;
  spo2: number | null;
  resp_rate: number | null;
  pain_score: number | null;
  source: string;
  device_label: string | null;
  quality: string;
};

export type VitalsInsert = {
  id?: string;
  patient_id: string;
  recorded_at: string;
  hr?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  temp_c?: number | null;
  spo2?: number | null;
  resp_rate?: number | null;
  pain_score?: number | null;
  source: string;
  device_label?: string | null;
  quality: string;
};

export type EcgReadingRow = {
  id: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm: number | null;
  source: string;
  pdf_url: string | null;
};

export type EcgReadingInsert = {
  id?: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm?: number | null;
  source?: string;
  pdf_url?: string | null;
};

export type CheckinRow = {
  id: string;
  patient_id: string;
  created_at: string;
  day_post_op: number;
  transcript: string | null;
  symptoms: unknown;
  vitals: unknown;
  decision: unknown;
  trend_findings: unknown;
  sbar: string | null;
};

export type CheckinInsert = {
  id?: string;
  patient_id: string;
  created_at?: string;
  day_post_op: number;
  transcript?: string | null;
  symptoms?: unknown;
  vitals?: unknown;
  decision?: unknown;
  trend_findings?: unknown;
  sbar?: string | null;
};

export type EscalationRow = {
  id: string;
  patient_id: string;
  checkin_id: string | null;
  level: string;
  condition: string | null;
  notified_caregiver_at: string | null;
};

export type EscalationInsert = {
  id?: string;
  patient_id: string;
  checkin_id?: string | null;
  level: string;
  condition?: string | null;
  notified_caregiver_at?: string | null;
};

type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      patients: TableDef<PatientRow, PatientInsert>;
      vitals: TableDef<VitalsRow, VitalsInsert>;
      ecg_readings: TableDef<EcgReadingRow, EcgReadingInsert>;
      checkins: TableDef<CheckinRow, CheckinInsert>;
      escalations: TableDef<EscalationRow, EscalationInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let cachedClient: SupabaseClient<Database> | null | undefined;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL and/or a Supabase key are not set — " +
        "persistence is disabled and callers will receive a null client.",
    );
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

export function getSupabase(): SupabaseClient<any> | null {
  return getSupabaseClient();
}

export interface CheckinRecord {
  dayPostOp: number;
  transcript?: string;
  symptoms: Symptoms;
  vitals: VitalsReading;
  decision: Decision;
  sbar?: string;
}

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
      patient_id: "00000000-0000-0000-0000-000000000000" // Fallback patient ID for direct checkins
    });
    return error ? `failed: ${error.message}` : "saved";
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

export interface PatientMessage {
  id?: string;
  created_at?: string;
  sender: string;
  content: string;
  read?: boolean;
}

export async function persistMessage(content: string, sender: string = "Care Team"): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return "not configured";
  try {
    const { error } = await supabase.from("patient_messages").insert({
      sender,
      content,
    });
    return error ? `failed: ${error.message}` : "saved";
  } catch (err) {
    return `failed: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

export async function fetchMessages(): Promise<PatientMessage[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("patient_messages")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function fetchCheckins(): Promise<any[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}
