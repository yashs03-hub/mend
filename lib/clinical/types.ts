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

export type EcgDetermination =
  | "normal_sinus_rhythm"
  | "atrial_fibrillation"
  | "tachycardia"
  | "bradycardia"
  | "unclassified";

/** Structured symptoms extracted from a spoken check-in. All optional: absent means "not reported", not "denied". */
export interface Symptoms {
  breathless?: boolean;
  chestPain?: boolean;
  calfPainOrSwelling?: boolean;
  woundDischarge?: boolean;
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
  /**
   * 0-10. Not read by any red-flag-engine rule — consumed exclusively by the
   * trend engine (`evaluateTrends` in `trends.ts`), which watches its slope
   * over time rather than any single-reading threshold.
   */
  painScore?: number;
}

export type VitalsSource =
  | "ble_heart_rate"
  | "manual"
  | "kardia_6l"
  | "simulated";

export interface VitalsReading {
  timestamp: string;
  hr?: number; // bpm
  sbp?: number; // mmHg
  dbp?: number; // mmHg
  tempC?: number;
  ecgFlags?: EcgFlag[];
  quality: "ok" | "poor" | "stale";
  spo2?: number;
  respRate?: number;
  /**
   * 0-10 pain score captured alongside this reading. Optional because BLE
   * heart-rate ticks and device spot-checks do not carry pain; voice
   * check-ins do. The trend engine prefers this per-row value over a
   * parallel symptoms array so the pain slope is computed from genuinely
   * distinct timepoints on real (non-fixture) history.
   */
  painScore?: number;
  source?: VitalsSource;
  deviceLabel?: string;
}

/** Output of the KardiaMobile 6L, consumed as-is. Mend never re-derives it. */
export interface EcgReading {
  recordedAt: string;
  determination: EcgDetermination;
  bpm?: number;
  source: "kardia_6l";
  pdfUrl?: string;
}

export interface Phase {
  name: string;
  dayStart: number;
  dayEnd: number;
  /** What counts as unremarkable *for this stage of recovery*. */
  normalEnvelope: {
    tempCMax: number;
    hrMax: number;
    spo2Min: number;
    source: string;
  };
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
  firedRules: string[];
}

export interface TrendFinding {
  id: string;
  metric: "hr" | "spo2" | "tempC" | "painScore";
  description: string;
  severity: Severity;
}
