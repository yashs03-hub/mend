import type { Decision } from "@/lib/clinical/types";

/**
 * Plain-language status for the patient portal — same calm rules as
 * family/copy.ts (no vitals, no rule ids), spoken to Margaret in the
 * second person.
 */
export interface PatientCopy {
  headline: string;
  /** Soft recovery context under the headline. */
  lede: string;
}

const WELL_LEDE =
  "Your pain has been easing, you slept through the night, and you've been up with your walker.";

export function patientCopy(decision: Decision): PatientCopy {
  switch (decision.level) {
    case "green":
      return {
        headline: "You're doing well today.",
        lede: WELL_LEDE,
      };
    case "amber":
      return {
        headline: "You're okay — one thing needs a look today.",
        lede: "This is not an emergency. Mend or your care team will help you sort the next step.",
      };
    case "red":
      return {
        headline: "You need medical help right now.",
        lede: "If you are not already getting help, call 911 or go to the emergency room.",
      };
  }
}
