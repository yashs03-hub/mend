import { isE164, maskPhone } from "./phone";

/**
 * Outbound check-in call — the button that makes a physical phone ring on
 * stage. A single POST to ElevenLabs' Twilio-native outbound-call endpoint;
 * ElevenLabs owns the actual Twilio dial on its side, so this module never
 * touches the Twilio SDK directly (unlike sms.ts, which does).
 *
 * Degrades gracefully: with any of the three ElevenLabs env vars absent,
 * this logs ONE warning naming exactly which vars are missing and returns
 * a typed `{ status: "skipped" }` result — it never throws, so a teammate
 * without ElevenLabs credentials can still exercise the rest of the app
 * (constraint: graceful degradation is mandatory).
 */

const ELEVENLABS_OUTBOUND_CALL_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

export interface StartCheckInCallInput {
  /** First name only — this is spoken/used as a dynamic variable, never a full DB display name. */
  name: string;
  /** E.164 destination number. */
  phone: string;
  dayPostOp: number;
  /** From Task 14's `lastCheckinSummary()`. Empty string is valid — it means "no prior check-in". */
  lastCheckinSummary?: string;
}

export type StartCheckInCallResult =
  | { status: "sent"; conversationId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/** Matches the global `fetch` signature so a fake can be injected in tests
 * without ever making a real network call (constraint: no real network
 * calls in tests). */
export type CallFetch = typeof fetch;

interface ElevenLabsCredentials {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
}

function loadCredentials(): ElevenLabsCredentials | undefined {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  const missing: string[] = [];
  if (!apiKey) missing.push("ELEVENLABS_API_KEY");
  if (!agentId) missing.push("ELEVENLABS_AGENT_ID");
  if (!agentPhoneNumberId) missing.push("ELEVENLABS_AGENT_PHONE_NUMBER_ID");

  if (missing.length > 0) {
    console.warn(
      `[telephony] ${missing.join(", ")} not set — outbound check-in calls are disabled.`,
    );
    return undefined;
  }

  return { apiKey: apiKey!, agentId: agentId!, agentPhoneNumberId: agentPhoneNumberId! };
}

/** Pure, network-free: builds the exact JSON body ElevenLabs expects.
 * Exported so the payload shape can be asserted in tests without a fetch. */
export function buildOutboundCallPayload(
  credentials: ElevenLabsCredentials,
  patient: StartCheckInCallInput,
): Record<string, unknown> {
  return {
    agent_id: credentials.agentId,
    agent_phone_number_id: credentials.agentPhoneNumberId,
    to_number: patient.phone,
    conversation_initiation_client_data: {
      dynamic_variables: {
        patient_name: patient.name,
        day_post_op: patient.dayPostOp,
        last_checkin_summary: patient.lastCheckinSummary ?? "",
      },
    },
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

async function safeReadJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Places the outbound ElevenLabs/Twilio check-in call. Never throws: every
 * failure mode (missing credentials, invalid phone, network error, non-2xx
 * response) returns a typed result instead.
 */
export async function startCheckInCall(
  patient: StartCheckInCallInput,
  fetchImpl: CallFetch = fetch,
): Promise<StartCheckInCallResult> {
  const credentials = loadCredentials();
  if (!credentials) {
    return {
      status: "skipped",
      reason: "ElevenLabs outbound-call credentials are not configured.",
    };
  }

  if (!isE164(patient.phone)) {
    console.warn(
      `[telephony] startCheckInCall: ${maskPhone(patient.phone)} is not a valid E.164 number — call not placed.`,
    );
    return { status: "error", reason: "Destination phone number is not a valid E.164 number." };
  }

  const payload = buildOutboundCallPayload(credentials, patient);

  try {
    const response = await fetchImpl(ELEVENLABS_OUTBOUND_CALL_URL, {
      method: "POST",
      headers: {
        "xi-api-key": credentials.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      console.warn(`[telephony] startCheckInCall: ElevenLabs responded with status ${response.status}.`);
      return {
        status: "error",
        reason: `ElevenLabs outbound-call request failed with status ${response.status}${detail ? `: ${detail}` : ""}.`,
      };
    }

    const data = await safeReadJson(response);
    const conversationId = typeof data?.conversation_id === "string" ? data.conversation_id : null;
    return { status: "sent", conversationId };
  } catch (err) {
    console.warn("[telephony] startCheckInCall: request to ElevenLabs failed.", err);
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "Unknown error calling ElevenLabs.",
    };
  }
}
