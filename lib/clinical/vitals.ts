import type { VitalsReading } from "./types";

/**
 * Physiologic plausibility envelopes. Values outside these ranges are
 * stripped by `usableVitals` (treated as sensor garbage, not clinical
 * signal). The demo console validates against the same numbers so an
 * operator sees the rejection immediately rather than after a silent drop.
 */
export const PLAUSIBLE_RANGES = {
  hr: { min: 20, max: 250, label: "Heart rate", unit: "bpm" },
  sbp: { min: 50, max: 260, label: "Systolic BP", unit: "mmHg" },
  dbp: { min: 20, max: 160, label: "Diastolic BP", unit: "mmHg" },
  tempC: { min: 30, max: 43, label: "Temperature", unit: "°C" },
  spo2: { min: 50, max: 100, label: "SpO₂", unit: "%" },
  respRate: { min: 4, max: 60, label: "Respiratory rate", unit: "/min" },
} as const;

export type PlausibleField = keyof typeof PLAUSIBLE_RANGES;

const isPlausible = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

export function isPlausibleField(field: PlausibleField, value: number): boolean {
  const range = PLAUSIBLE_RANGES[field];
  return Number.isFinite(value) && isPlausible(value, range.min, range.max);
}

/** Human-readable validation error, or null when the value is usable. */
export function plausibilityError(
  field: PlausibleField,
  value: number | undefined,
): string | null {
  if (value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return `${PLAUSIBLE_RANGES[field].label} must be a finite number.`;
  }
  if (isPlausibleField(field, value)) {
    return null;
  }
  const { min, max, label, unit } = PLAUSIBLE_RANGES[field];
  return `${label} must be between ${min} and ${max} ${unit}.`;
}

export interface ManualVitalsInput {
  spo2?: number;
  sbp?: number;
  dbp?: number;
  tempC?: number;
}

export interface ManualVitalsValidation {
  ok: boolean;
  errors: Partial<Record<keyof ManualVitalsInput, string>>;
}

/**
 * Console-facing validation for the three manually entered signals.
 * Empty fields are allowed (partial readings); filled fields must sit
 * inside the plausibility envelope.
 */
export function validateManualVitals(input: ManualVitalsInput): ManualVitalsValidation {
  const errors: ManualVitalsValidation["errors"] = {};
  for (const field of ["spo2", "sbp", "dbp", "tempC"] as const) {
    const value = input[field];
    if (value === undefined) {
      continue;
    }
    const error = plausibilityError(field, value);
    if (error) {
      errors[field] = error;
    }
  }
  if (
    input.sbp !== undefined &&
    input.dbp !== undefined &&
    !errors.sbp &&
    !errors.dbp &&
    input.sbp <= input.dbp
  ) {
    errors.sbp = "Systolic BP must be greater than diastolic BP.";
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function usableVitals(v: VitalsReading): VitalsReading {
  if (v.quality !== "ok") {
    return {
      timestamp: v.timestamp,
      quality: v.quality,
      source: v.source,
      deviceLabel: v.deviceLabel,
      ecgFlags: v.ecgFlags,
    };
  }

  return {
    timestamp: v.timestamp,
    source: v.source,
    deviceLabel: v.deviceLabel,
    quality: v.quality,
    ecgFlags: v.ecgFlags,
    ...(v.hr !== undefined && isPlausibleField("hr", v.hr) ? { hr: v.hr } : {}),
    ...(v.sbp !== undefined && isPlausibleField("sbp", v.sbp) ? { sbp: v.sbp } : {}),
    ...(v.dbp !== undefined && isPlausibleField("dbp", v.dbp) ? { dbp: v.dbp } : {}),
    ...(v.tempC !== undefined && isPlausibleField("tempC", v.tempC)
      ? { tempC: v.tempC }
      : {}),
    ...(v.spo2 !== undefined && isPlausibleField("spo2", v.spo2) ? { spo2: v.spo2 } : {}),
    ...(v.respRate !== undefined && isPlausibleField("respRate", v.respRate)
      ? { respRate: v.respRate }
      : {}),
  };
}
