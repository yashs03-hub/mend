import { VitalsReading } from "@/lib/clinical/types";

export type Scenario = "green" | "pe" | "fever";

/**
 * Stands in for a real Bluetooth peripheral feed (cuff, pulse oximeter,
 * single-lead patch ECG, thermometer) so the demo is controllable on stage.
 *
 * The numbers are fixed rather than randomised: a demo that occasionally
 * produces a different verdict is worse than no demo at all.
 */
export function scenarioVitals(scenario: Scenario, now: string): VitalsReading {
  if (scenario === "pe") {
    return {
      timestamp: now,
      hr: 122,
      sbp: 104,
      dbp: 68,
      tempC: 37.4,
      ecgFlags: ["sinus_tachycardia"],
      source: "simulated",
      quality: "ok",
    };
  }
  if (scenario === "fever") {
    // 37.8 C — deliberately inside the early-phase envelope (38.0) and outside
    // the later one (37.5). Holding the vitals still and moving only the day
    // is what demonstrates that the engine is stage-aware rather than
    // threshold-blind.
    return {
      timestamp: now,
      hr: 88,
      sbp: 118,
      dbp: 74,
      tempC: 37.8,
      ecgFlags: ["normal"],
      source: "simulated",
      quality: "ok",
    };
  }
  return {
    timestamp: now,
    hr: 78,
    sbp: 118,
    dbp: 74,
    tempC: 37.1,
    ecgFlags: ["normal"],
    source: "simulated",
    quality: "ok",
  };
}
