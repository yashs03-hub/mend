import { NextResponse } from "next/server";
import { extractEcg } from "@/lib/llm/ecg";
import { getSupabaseClient } from "@/lib/db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/supabase";

const DEMO_PATIENT_NAME = "Margaret (demo, synthetic)";

/**
 * POST /api/ecg — accepts a multipart PDF upload of a KardiaMobile 6L
 * report, extracts `{ determination, bpm, recordedAt }` via Claude
 * (lib/llm/ecg.ts), and persists it to `ecg_readings`. Never decides
 * escalation itself; that is `evaluate()`'s job once this reading is fed
 * back into the clinical layer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured — Kardia PDF extraction is unavailable.",
      },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart/form-data body.' }, { status: 400 });
  }

  const file = formData.get("pdf");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing "pdf" file field.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const reading = await extractEcg(buffer);

  const patientIdField = formData.get("patientId");
  const requestedPatientId = typeof patientIdField === "string" ? patientIdField : undefined;

  const supabase = getSupabaseClient();
  let persisted = false;

  if (!supabase) {
    console.warn("[api/ecg] Supabase client unavailable — returning the reading without persisting it.");
  } else {
    const patientId = requestedPatientId ?? (await resolveDemoPatientId(supabase));
    if (!patientId) {
      console.warn("[api/ecg] no patient id available (none supplied and demo patient not found) — skipping persistence.");
    } else {
      const { error } = await supabase.from("ecg_readings").insert({
        patient_id: patientId,
        recorded_at: reading.recordedAt,
        determination: reading.determination,
        bpm: reading.bpm ?? null,
        source: reading.source,
      });
      if (error) {
        console.warn("[api/ecg] failed to persist ecg reading:", error.message);
      } else {
        persisted = true;
      }
    }
  }

  return NextResponse.json({ reading, persisted });
}

async function resolveDemoPatientId(
  supabase: SupabaseClient<Database>,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("name", DEMO_PATIENT_NAME)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }
  return data.id;
}
