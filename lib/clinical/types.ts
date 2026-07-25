/**
 * Shared clinical types for Mend.
 *
 * These describe the boundary between the LLM edges and the deterministic core.
 * `Symptoms` is the only thing the language model is allowed to produce; every
 * field below it — the phase envelopes, the decision — is computed by code.
 */

export type Severity = "green" | "amber" | "red";

export type EcgFlag =
  | "normal"
  | "sinus_tachycardia"
  | "new_af"
  | "right_heart_strain";

/** Structured symptoms extracted from a spoken check-in. All optional: absent means "not reported", not "denied". */
export interface Symptoms {
  breathless?: boolean;
  chestPain?: boolean;
  calfPainOrSwelling?: boolean;
  woundDischarge?: boolean;
  /**
   * Reserved: not yet read by any red-flag rule. The engine currently acts
   * only on device temperature (`VitalsReading.tempC`) via `fevered`, never
   * on a subjective report alone. Documented gap, not an oversight — wire
   * this in deliberately if subjective-only fever is meant to be actionable.
   */
  feverSubjective?: boolean;
  suddenSevereHipPain?: boolean;
  legShortenedOrRotated?: boolean;
  unableToWeightBear?: boolean;
  /** false = pain NOT controlled. undefined = not asked/not answered. */
  painControlled?: boolean;
  newConfusion?: boolean;
  // Shoulder / Latarjet specific symptoms
  deltoidSensationLoss?: boolean;
  unableToElevateArm?: boolean;
}

export interface VitalsReading {
  timestamp: string;
  hr?: number; // bpm
  sbp?: number; // mmHg
  dbp?: number; // mmHg
  tempC?: number;
  ecgFlags?: EcgFlag[];
  quality: "ok" | "poor" | "stale";
}

export interface Phase {
  name: string;
  dayStart: number;
  dayEnd: number;
  /** What counts as unremarkable *for this stage of recovery*. */
  normalEnvelope: { tempCMax: number; hrMax: number };
  rehab: string[];
  precautions: string[];
  weightBearing: string;
}

export interface Decision {
  level: Severity;
  /** e.g. "Suspected pulmonary embolism". Absent on green. */
  condition?: string;
  /** Patient-facing instruction. */
  action: string;
  call?: "911" | "ER" | "surgeon_office" | "nurse_line";
  /** Machine-readable reasons — feeds the SBAR and the audit trail. */
  rationale: string[];
}
