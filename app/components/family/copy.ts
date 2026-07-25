import { TREND_ESCALATION_RULE_ID } from "@/lib/clinical/compose";
import type { Decision, TrendFinding } from "@/lib/clinical/types";

/**
 * Translates the engine's Decision into the words a worried daughter reads
 * on her phone. Pure and total over Decision, like scripts.ts — but where
 * scripts.ts speaks TO Margaret in the second person, this speaks ABOUT her
 * to her family in the third.
 *
 * The rules of this surface:
 * - No numbers except the ones you dial. No vitals values, no thresholds,
 *   no rule ids, no clinical shorthand. The daughter cannot interpret a
 *   heart rate; showing her one only manufactures anxiety.
 * - Every attention state says explicitly whether this is an emergency,
 *   because "do I need to drive over?" is the only question being asked.
 */

export interface FamilyCopy {
  /** The one serif sentence that answers "is Mom all right?". */
  headline: string;
  /** What happened, in plain words. Absent when everything is fine. */
  whatHappened?: string;
  /** What Mend asked her to do. Absent when everything is fine. */
  whatMendAsked?: string;
}

/**
 * Keyed on `TrendFinding.metric`, so a trend-raised amber can be described
 * without repeating the clinician-facing description (which names slopes
 * and thresholds this surface must never show).
 */
const TREND_PLAIN: Readonly<Record<TrendFinding["metric"], string>> = {
  hr: "her heart rate has been creeping up a little each day",
  spo2: "her oxygen level has been drifting down a little",
  tempC: "her temperature has been edging up over the past few days",
  painScore: "her pain has been slowly building",
};

/** Keyed on the exact `condition` strings from red-flag-engine's AMBER_RULES. */
const AMBER_PLAIN: Readonly<Record<string, string>> = {
  "Possible DVT":
    "She mentioned some pain and swelling in her calf, and that needs to be checked.",
  "Possible wound infection":
    "Her wound, or her temperature, needs to be looked at.",
  "New atrial fibrillation":
    "Her heart tracing this morning showed a new irregular rhythm.",
  "Uncontrolled pain": "Her pain isn't well controlled at the moment.",
  "New confusion":
    "She seemed a little more confused than usual on this morning's call.",
  "Vitals unavailable or unreliable":
    "Mend couldn't get a clear reading from her monitor this morning.",
};

const AMBER_FALLBACK = "Something on this morning's call needs a closer look.";

/** Keyed on the exact `condition` strings from red-flag-engine's RED_RULES. */
const RED_PLAIN: Readonly<Record<string, string>> = {
  "Suspected pulmonary embolism":
    "Her breathing and her heart rate together can be a sign of a blood clot in her lung.",
  Hypoxia: "The oxygen level in her blood is too low right now.",
  "Suspected shock / bleeding":
    "Her blood pressure is very low, which can be a sign of serious bleeding.",
  "Suspected hip dislocation": "Her hip may have come out of its socket.",
  "Possible sepsis":
    "Her fever and heart rate together can be a sign of a serious infection.",
};

const RED_FALLBACK = "Her symptoms need urgent medical attention right now.";

function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) {
    return phrases[0] ?? "";
  }
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

function amberWhatHappened(
  decision: Decision,
  trendFindings: readonly TrendFinding[],
): string {
  // A trend-raised amber: describe the drift in family words, never by
  // echoing the finding's clinician-facing description.
  if (decision.firedRules.includes(TREND_ESCALATION_RULE_ID)) {
    const metrics = [...new Set(trendFindings.map((f) => f.metric))];
    const phrases = metrics.map((m) => TREND_PLAIN[m]);
    if (phrases.length > 0) {
      return (
        `On this morning's call, Mend noticed ${joinPhrases(phrases)}. ` +
        "Nothing has suddenly gone wrong — this is not an emergency."
      );
    }
  }

  const reason = decision.condition
    ? (AMBER_PLAIN[decision.condition] ?? AMBER_FALLBACK)
    : AMBER_FALLBACK;
  return `${reason} This is not an emergency.`;
}

function whatMendAsked(decision: Decision): string {
  switch (decision.call) {
    case "911":
      return "Mend told her to call 911 straight away, and stayed on the line while she dialed.";
    case "ER":
      return "Mend told her to go to the emergency room straight away.";
    case "surgeon_office":
      return "Mend asked her to call the surgeon's office today.";
    case "nurse_line":
      return "Mend asked her to call the nurse line today.";
    default:
      return "Mend asked her to keep following her recovery plan.";
  }
}

export function familyCopy(
  decision: Decision,
  trendFindings: readonly TrendFinding[] = [],
): FamilyCopy {
  switch (decision.level) {
    case "green":
      return { headline: "Mom's doing well today." };
    case "amber":
      return {
        headline: "Mom's okay — one thing needs a look today.",
        whatHappened: amberWhatHappened(decision, trendFindings),
        whatMendAsked: whatMendAsked(decision),
      };
    case "red":
      return {
        headline: "Mom needs medical help right now.",
        whatHappened: decision.condition
          ? (RED_PLAIN[decision.condition] ?? RED_FALLBACK)
          : RED_FALLBACK,
        whatMendAsked: whatMendAsked(decision),
      };
  }
}
