import type { Symptoms, VitalsReading } from "./types";

/**
 * Builds the parallel symptoms array `evaluateTrends` expects.
 *
 * Pain scores now live on each vitals row (`painScore`); we project them
 * into this array and overlay the current check-in's symptoms on the most
 * recent point so an in-flight extraction still participates before the
 * row is written.
 */
export function buildSymptomsHistory(history: VitalsReading[], latest: Symptoms): Symptoms[] {
  return history.map((reading, i) => {
    const fromRow: Symptoms =
      typeof reading.painScore === "number" ? { painScore: reading.painScore } : {};
    return i === history.length - 1 ? { ...fromRow, ...latest } : fromRow;
  });
}
