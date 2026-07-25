import type { EcgReading, VitalsReading } from "../clinical/types";

/**
 * Demo scenario fixtures for the console's scenario selector.
 *
 * - "green": a well patient, POD 4, nothing remarkable.
 * - "pe": an acute pulmonary-embolism-pattern event (breathless, tachycardic,
 *   hypoxic, ECG tachycardia) on top of an otherwise normal baseline.
 * - "drift": every single reading — including the very latest — sits inside
 *   the phase envelope. The only thing that catches it is `evaluateTrends()`
 *   picking up the resting heart rate climbing ~3 bpm/day. This is the
 *   fixture that drives the headline trend-engine demo.
 *
 * All scenarios are constructed to fall within the "Early protected" phase
 * (day 0-13) throughout their 14-day trailing window, so a single phase
 * envelope applies to every reading.
 */
export type Scenario = "green" | "pe" | "drift";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 14;

function simulatedReading(
  timestamp: string,
  partial: Omit<VitalsReading, "timestamp" | "source" | "quality">,
): VitalsReading {
  return {
    timestamp,
    source: "simulated",
    quality: "ok",
    ...partial,
  };
}

const GREEN_VITALS = { hr: 76, sbp: 122, dbp: 78, tempC: 36.9, spo2: 97, respRate: 16 };
const PE_ACUTE_VITALS = { hr: 122, sbp: 132, dbp: 84, tempC: 37.0, spo2: 91, respRate: 26 };
const PE_BASELINE_VITALS = { hr: 75, sbp: 120, dbp: 76, tempC: 36.9, spo2: 97, respRate: 15 };
const DRIFT_TODAY_VITALS = { hr: 99, sbp: 124, dbp: 80, tempC: 36.8, spo2: 97, respRate: 16 };

export function scenarioVitals(scenario: Scenario, now: Date): VitalsReading {
  const timestamp = now.toISOString();

  switch (scenario) {
    case "green":
      return simulatedReading(timestamp, GREEN_VITALS);
    case "pe":
      return simulatedReading(timestamp, PE_ACUTE_VITALS);
    case "drift":
      return simulatedReading(timestamp, DRIFT_TODAY_VITALS);
  }
}

/**
 * 14 days of trailing readings ending "now" (today), one per day.
 *
 * drift's HR climbs linearly by exactly 3 bpm/day, from 60 to 99 — sitting
 * exactly on the inclusive lower boundary of `evaluateTrends()`'s +3 bpm/day
 * amber threshold (the check is `slope >= 3`, so this fixture is a boundary
 * hit, not a margin) on both the full series and its trailing-7-reading
 * window, while the highest value (99) still sits strictly inside the
 * phase's hrMax of 100.
 */
export function scenarioHistory(scenario: Scenario): VitalsReading[] {
  const now = new Date();
  const readings: VitalsReading[] = [];

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const timestamp = new Date(now.getTime() - daysAgo * MS_PER_DAY).toISOString();

    if (scenario === "green") {
      readings.push(simulatedReading(timestamp, GREEN_VITALS));
      continue;
    }

    if (scenario === "pe") {
      readings.push(
        simulatedReading(timestamp, daysAgo === 0 ? PE_ACUTE_VITALS : PE_BASELINE_VITALS),
      );
      continue;
    }

    const dayIndex = HISTORY_DAYS - 1 - daysAgo; // 0 (oldest) .. 13 (today)
    readings.push(
      simulatedReading(timestamp, {
        hr: 60 + dayIndex * 3,
        sbp: 124,
        dbp: 80,
        tempC: 36.8,
        spo2: 97,
        respRate: 16,
      }),
    );
  }

  return readings;
}

export function scenarioEcg(scenario: Scenario): EcgReading {
  const recordedAt = new Date().toISOString();

  switch (scenario) {
    case "green":
      return { recordedAt, determination: "normal_sinus_rhythm", bpm: 76, source: "kardia_6l" };
    case "pe":
      return { recordedAt, determination: "tachycardia", bpm: 122, source: "kardia_6l" };
    case "drift":
      return { recordedAt, determination: "normal_sinus_rhythm", bpm: 99, source: "kardia_6l" };
  }
}
