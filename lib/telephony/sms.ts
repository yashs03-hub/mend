import twilioLib from "twilio";
import type { Decision } from "../clinical/types";
import { isE164, maskPhone } from "./phone";

/**
 * Caregiver SMS notification — fired from the /api/checkin escalation path
 * on AMBER and RED only, never on green (a caregiver woken at 3am by a
 * green check-in is the kind of bug that destroys trust in this product).
 *
 * Degrades gracefully: with any required Twilio env var (or a destination
 * number) absent, this logs ONE warning naming exactly what is missing and
 * returns a typed `{ status: "skipped" }` result rather than throwing.
 */

const MAX_SMS_LENGTH = 1500;

export interface NotifyCaregiverPatient {
  /** First name only, used in the message body. */
  name: string;
  /** From the patient row's `caregiver_phone` column. Falls back to
   * `DEMO_CAREGIVER_PHONE` when absent, per the task brief. */
  caregiverPhone?: string | null;
}

export type NotifyCaregiverResult =
  | { status: "sent"; sid: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/** The minimal shape of a Twilio client this module actually uses —
 * injectable so tests never construct a real `twilio()` client or make a
 * real network call. */
export interface TwilioMessageClient {
  messages: {
    create(args: { to: string; from: string; body: string }): Promise<{ sid: string }>;
  };
}

export type TwilioClientFactory = () => TwilioMessageClient | null;

function defaultTwilioClientFactory(): TwilioMessageClient | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return null;
  }
  return twilioLib(accountSid, authToken) as unknown as TwilioMessageClient;
}

/** Pure, network-free: renders the condition, action, and SBAR into the SMS
 * body, then truncates to `MAX_SMS_LENGTH` characters. Exported for testing
 * without a Twilio client. */
export function buildCaregiverMessage(
  patientName: string,
  decision: Decision,
  sbar: string,
): string {
  const conditionLine = decision.condition ?? `${decision.level.toUpperCase()} check-in`;
  const message =
    `Mend alert for ${patientName} — ${decision.level.toUpperCase()}\n` +
    `Condition: ${conditionLine}\n` +
    `Action: ${decision.action}\n\n` +
    `${sbar}`;

  return message.length > MAX_SMS_LENGTH ? message.slice(0, MAX_SMS_LENGTH) : message;
}

/**
 * Sends the caregiver SMS for an amber/red decision. Never throws — every
 * failure mode (green decision, missing credentials, no destination number,
 * invalid E.164, Twilio error) returns a typed result instead.
 */
export async function notifyCaregiver(
  patient: NotifyCaregiverPatient,
  decision: Decision,
  sbar: string,
  clientFactory: TwilioClientFactory = defaultTwilioClientFactory,
): Promise<NotifyCaregiverResult> {
  if (decision.level === "green") {
    return {
      status: "skipped",
      reason: "Decision level is green — caregiver notification is never sent for green check-ins.",
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = patient.caregiverPhone || process.env.DEMO_CAREGIVER_PHONE;

  const missing: string[] = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!fromNumber) missing.push("TWILIO_FROM_NUMBER");
  if (!toNumber) missing.push("DEMO_CAREGIVER_PHONE");

  if (missing.length > 0) {
    console.warn(`[telephony] ${missing.join(", ")} not set — caregiver SMS notification is disabled.`);
    return { status: "skipped", reason: `Missing configuration: ${missing.join(", ")}.` };
  }

  // `missing` being empty above proves both are defined at runtime, but
  // that fact isn't visible to the type checker across the array-based
  // check, so make it explicit here rather than threading optionals
  // through the rest of this function.
  const to: string = toNumber ?? "";
  const from: string = fromNumber ?? "";

  if (!isE164(to)) {
    console.warn(
      `[telephony] notifyCaregiver: caregiver number ${maskPhone(to)} is not a valid E.164 number — SMS not sent.`,
    );
    return { status: "error", reason: "Caregiver phone number is not a valid E.164 number." };
  }

  if (!isE164(from)) {
    console.warn(
      `[telephony] notifyCaregiver: TWILIO_FROM_NUMBER ${maskPhone(from)} is not a valid E.164 number — SMS not sent.`,
    );
    return { status: "error", reason: "TWILIO_FROM_NUMBER is not a valid E.164 number." };
  }

  const client = clientFactory();
  if (!client) {
    console.warn(
      "[telephony] notifyCaregiver: Twilio client unavailable despite configured credentials — SMS not sent.",
    );
    return { status: "skipped", reason: "Twilio client could not be created." };
  }

  const body = buildCaregiverMessage(patient.name, decision, sbar);

  try {
    const message = await client.messages.create({ to, from, body });
    return { status: "sent", sid: message.sid };
  } catch (err) {
    console.warn(`[telephony] notifyCaregiver: Twilio send failed for ${maskPhone(to)}.`, err);
    return { status: "error", reason: err instanceof Error ? err.message : "Unknown Twilio error." };
  }
}
