import { VitalsReading } from "./types";

/**
 * Physiologically plausible ranges. Anything outside these is a device artefact,
 * not a patient finding — a cuff reading 300 bpm means the cuff is wrong.
 */
const PLAUSIBLE = {
  hr: [20, 250],
  sbp: [50, 260],
  dbp: [20, 160],
  tempC: [30, 43],
} as const;

function keep(
  n: number | undefined,
  range: readonly [number, number],
): number | undefined {
  return n !== undefined && n >= range[0] && n <= range[1] ? n : undefined;
}

/**
 * Strip anything we cannot trust, so a bad reading can neither reassure nor
 * falsely escalate. Dropping a field is deliberately safer than keeping it:
 * the engine treats "no usable vitals" as grounds to escalate on symptoms alone
 * rather than as grounds to reassure.
 *
 * ECG flags survive a poor-quality reading because a rhythm label is a
 * classifier output rather than a numeric measurement, and losing it would
 * discard the corroboration that distinguishes a red flag from a worry.
 */
export function usableVitals(v: VitalsReading): VitalsReading {
  if (v.quality !== "ok") {
    return { timestamp: v.timestamp, quality: v.quality, ecgFlags: v.ecgFlags };
  }
  return {
    timestamp: v.timestamp,
    quality: v.quality,
    hr: keep(v.hr, PLAUSIBLE.hr),
    sbp: keep(v.sbp, PLAUSIBLE.sbp),
    dbp: keep(v.dbp, PLAUSIBLE.dbp),
    tempC: keep(v.tempC, PLAUSIBLE.tempC),
    ecgFlags: v.ecgFlags,
  };
}
