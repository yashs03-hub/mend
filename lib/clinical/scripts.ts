import type { Decision } from "./types";

/**
 * Maps a `Decision` (from `evaluate()` in red-flag-engine.ts, optionally
 * raised green-to-amber by `composeDecision()` in compose.ts) to the exact
 * sentence a voice agent must speak on a live call.
 *
 * This is a PURE function, deliberately not an LLM call. It is what makes
 * Mend's "the model never decides whether to escalate" claim provable on
 * stage: the words a patient hears on a red escalation already existed,
 * verbatim, before the phone call started. The agent is handed a decision
 * it did not make and a script it did not write, and it reads that script
 * — it cannot substitute its own judgement or soften/escalate the wording.
 *
 * Written for an 82-year-old listener on a phone call, not a reader:
 * - Short sentences. No subordinate clauses stacking multiple facts.
 * - No clinical jargon — "blood clot in your lung", not "pulmonary
 *   embolism"; the clinical name still travels in `condition`/`reason` for
 *   the transcript and SBAR, never in the spoken script.
 * - The action is the first thing said after the patient's name, and it is
 *   repeated at the end of a red script as the single instruction to walk
 *   away with — never buried after the explanation.
 * - Exactly one instruction per script. Red always means "call 911 now" (or
 *   "go to the emergency room now" for the rare `call: "ER"` case); amber
 *   always means "call one specific number today"; green asks for nothing.
 */

export const DEFAULT_PATIENT_FIRST_NAME = "Margaret";

/**
 * "Margaret (demo, synthetic)" -> "Margaret". A voice script should never
 * speak the parenthetical demo/synthetic annotation stored in the database
 * display name, so this strips everything from the first space or "("
 * onward. Falls back to the default demo first name if `fullName` is
 * empty after trimming, which can only happen for a malformed row.
 */
export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return DEFAULT_PATIENT_FIRST_NAME;
  }
  const match = trimmed.match(/^[^\s(]+/);
  return match ? match[0] : trimmed;
}

/**
 * Plain-language reasons keyed by the exact `condition` strings produced by
 * red-flag-engine.ts's RED_RULES. Any condition not listed here (there
 * shouldn't be one, but a lookup table must never throw on an unmapped key)
 * falls back to `DEFAULT_RED_REASON`.
 */
const RED_PLAIN_REASON: Readonly<Record<string, string>> = {
  "Suspected pulmonary embolism":
    "Your breathing and your heart rate together can be a sign of a blood clot in your lung.",
  Hypoxia: "The oxygen level in your blood is too low right now.",
  "Suspected shock / bleeding":
    "Your blood pressure is very low. This can be a sign of serious bleeding.",
  "Suspected hip dislocation": "Your hip may have come out of its socket.",
  "Possible sepsis":
    "Your fever and your heart rate together can be a sign of a serious infection spreading in your body.",
};

const DEFAULT_RED_REASON = "Your symptoms need urgent medical attention right now.";

/** Same idea for AMBER_RULES's condition strings, plus the trend-escalation
 * condition text from compose.ts. */
const AMBER_PLAIN_REASON: Readonly<Record<string, string>> = {
  "Possible DVT": "The pain or swelling in your calf could be a blood clot.",
  "Possible wound infection": "Your wound or your temperature needs to be checked.",
  "New atrial fibrillation": "Your heart tracing showed a new irregular heartbeat.",
  "Uncontrolled pain": "Your pain is not well controlled on your current plan.",
  "New confusion": "You have had some new confusion since your surgery.",
  "Vitals unavailable or unreliable": "We could not get a clear reading from your monitor.",
};

const DEFAULT_AMBER_REASON = "Something in your check-in needs a closer look today.";

function redScript(decision: Decision, name: string): string {
  const reason = decision.condition
    ? (RED_PLAIN_REASON[decision.condition] ?? DEFAULT_RED_REASON)
    : DEFAULT_RED_REASON;

  if (decision.call === "ER") {
    return `${name}, I need you to go to the emergency room now. ${reason} Please go now — do not wait.`;
  }

  return `${name}, I need you to hang up and call 911 now. ${reason} Please call 911 now — do not wait.`;
}

function amberContactPhrase(call: Decision["call"]): string {
  if (call === "surgeon_office") {
    return "your surgeon's office";
  }
  if (call === "nurse_line") {
    return "the nurse line";
  }
  return "your care team";
}

function amberScript(decision: Decision, name: string): string {
  const reason = decision.condition
    ? (AMBER_PLAIN_REASON[decision.condition] ?? DEFAULT_AMBER_REASON)
    : DEFAULT_AMBER_REASON;
  const contact = amberContactPhrase(decision.call);

  return `${name}, please call ${contact} today. ${reason} This is not an emergency, so there is no need to panic.`;
}

function greenScript(name: string): string {
  return `${name}, everything looks good today. Keep following your recovery plan. Call us if anything changes.`;
}

/**
 * The exact sentence the voice agent must speak for `decision`. Callers
 * (the /api/triage route) must use this return value verbatim — never
 * paraphrase, truncate, or hand it to an LLM to "improve".
 */
export function scriptForDecision(
  decision: Decision,
  patientFirstName: string = DEFAULT_PATIENT_FIRST_NAME,
): string {
  switch (decision.level) {
    case "red":
      return redScript(decision, patientFirstName);
    case "amber":
      return amberScript(decision, patientFirstName);
    case "green":
      return greenScript(patientFirstName);
  }
}
