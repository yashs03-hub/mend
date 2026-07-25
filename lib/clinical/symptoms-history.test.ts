import { describe, expect, it } from "vitest";
import { buildSymptomsHistory } from "./symptoms-history";
import type { VitalsReading } from "./types";

function reading(partial: Partial<VitalsReading> = {}): VitalsReading {
  return {
    timestamp: "2026-07-25T09:00:00.000Z",
    source: "simulated",
    quality: "ok",
    hr: 78,
    ...partial,
  };
}

describe("buildSymptomsHistory", () => {
  it("projects per-row painScore onto every historical point", () => {
    const history = [
      reading({ timestamp: "2026-07-23T09:00:00.000Z", painScore: 3 }),
      reading({ timestamp: "2026-07-24T09:00:00.000Z", painScore: 5 }),
      reading({ timestamp: "2026-07-25T09:00:00.000Z", painScore: 6 }),
    ];

    expect(buildSymptomsHistory(history, { painScore: 7, breathless: true })).toEqual([
      { painScore: 3 },
      { painScore: 5 },
      { painScore: 7, breathless: true },
    ]);
  });

  it("leaves historical points empty when the row carries no painScore", () => {
    const history = [reading(), reading()];
    expect(buildSymptomsHistory(history, { painControlled: true })).toEqual([
      {},
      { painControlled: true },
    ]);
  });
});
