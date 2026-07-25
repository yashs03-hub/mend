import { NextResponse } from "next/server";

/**
 * GET /api/demo-status — which credentials the demo box currently has.
 *
 * Returns booleans only (never secret values). The console uses this to
 * warn the presenter before they click a path that will degrade, naming
 * exactly which env vars are empty.
 */

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(): Promise<NextResponse> {
  const anthropic = present(process.env.ANTHROPIC_API_KEY);
  const supabase =
    present(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (present(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
      present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const elevenlabs =
    present(process.env.ELEVENLABS_API_KEY) &&
    present(process.env.ELEVENLABS_AGENT_ID) &&
    present(process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID);
  const twilio =
    present(process.env.TWILIO_ACCOUNT_SID) &&
    present(process.env.TWILIO_AUTH_TOKEN) &&
    present(process.env.TWILIO_FROM_NUMBER);
  const demoPatientPhone = present(process.env.DEMO_PATIENT_PHONE);

  const missing: string[] = [];
  if (!anthropic) missing.push("ANTHROPIC_API_KEY");
  if (!supabase) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
    missing.push("SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }
  if (!elevenlabs) {
    if (!present(process.env.ELEVENLABS_API_KEY)) missing.push("ELEVENLABS_API_KEY");
    if (!present(process.env.ELEVENLABS_AGENT_ID)) missing.push("ELEVENLABS_AGENT_ID");
    if (!present(process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID)) {
      missing.push("ELEVENLABS_AGENT_PHONE_NUMBER_ID");
    }
  }
  if (!twilio) {
    if (!present(process.env.TWILIO_ACCOUNT_SID)) missing.push("TWILIO_ACCOUNT_SID");
    if (!present(process.env.TWILIO_AUTH_TOKEN)) missing.push("TWILIO_AUTH_TOKEN");
    if (!present(process.env.TWILIO_FROM_NUMBER)) missing.push("TWILIO_FROM_NUMBER");
  }
  if (!demoPatientPhone) missing.push("DEMO_PATIENT_PHONE");

  return NextResponse.json({
    anthropic,
    supabase,
    elevenlabs,
    twilio,
    demoPatientPhone,
    missing,
  });
}
