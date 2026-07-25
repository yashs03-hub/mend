/**
 * Shared phone-number helpers for lib/telephony/*. Kept tiny and dependency-
 * free so both `call.ts` (ElevenLabs/Twilio outbound call) and `sms.ts`
 * (Twilio caregiver SMS) validate and log phone numbers identically.
 */

/** RFC 3966 / ITU-T E.164: a leading "+", a non-zero first digit, and up to
 * 15 digits total. No spaces, dashes, or parens — callers are expected to
 * normalize before validating. */
const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function isE164(value: string | null | undefined): value is string {
  return typeof value === "string" && E164_PATTERN.test(value);
}

/**
 * Masks a phone number for logs: keeps the leading "+" and country-code-ish
 * prefix plus the last two digits, replaces everything else with "*".
 * Never log a full phone number (constraint #6) — this is the one function
 * every telephony log line must route through.
 */
export function maskPhone(value: string): string {
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }

  const visibleStart = value.startsWith("+") ? 3 : 2;
  const visibleEnd = 2;
  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  const maskedLength = Math.max(value.length - visibleStart - visibleEnd, 3);
  return `${start}${"*".repeat(maskedLength)}${end}`;
}
