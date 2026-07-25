import { describe, expect, it } from "vitest";
import { buildCheckinVitalsInsert } from "./build-checkin-vitals-insert";
import type { VitalsReading } from "@/lib/clinical/types";

function vitals(partial: Partial<VitalsReading> = {}): VitalsReading {
  return {
    timestamp: "2026-07-24T10:00:00.000Z",
    hr: 78,
    sbp: 118,
    dbp: 72,
    tempC: 36.8,
    spo2: 98,
    respRate: 14,
    painScore: 4,
    source: "simulated",
    deviceLabel: "demo cuff",
    quality: "ok",
    ...partial,
  };
}

describe("buildCheckinVitalsInsert", () => {
  it("stamps a fresh recorded_at distinct from the prior vitals timestamp", () => {
    const prior = vitals();
    const now = "2026-07-25T15:24:00.000Z";

    const row = buildCheckinVitalsInsert(prior, 6, now);

    expect(row.recorded_at).toBe(now);
    expect(row.recorded_at).not.toBe(prior.timestamp);
    expect(row.hr).toBe(78);
    expect(row.sbp).toBe(118);
    expect(row.dbp).toBe(72);
    expect(row.temp_c).toBe(36.8);
    expect(row.spo2).toBe(98);
    expect(row.resp_rate).toBe(14);
    expect(row.pain_score).toBe(6);
    expect(row.source).toBe("simulated");
    expect(row.device_label).toBe("demo cuff");
    expect(row.quality).toBe("ok");
  });

  it("nulls missing physiologic fields without borrowing the prior timestamp", () => {
    const prior = vitals({
      timestamp: "2026-07-20T08:00:00.000Z",
      hr: undefined,
      sbp: undefined,
      dbp: undefined,
      tempC: undefined,
      spo2: undefined,
      respRate: undefined,
      deviceLabel: undefined,
    });
    const now = "2026-07-25T16:00:00.000Z";

    const row = buildCheckinVitalsInsert(prior, null, now);

    expect(row.recorded_at).toBe(now);
    expect(row.recorded_at).not.toBe(prior.timestamp);
    expect(row.hr).toBeNull();
    expect(row.sbp).toBeNull();
    expect(row.dbp).toBeNull();
    expect(row.temp_c).toBeNull();
    expect(row.spo2).toBeNull();
    expect(row.resp_rate).toBeNull();
    expect(row.device_label).toBeNull();
    expect(row.pain_score).toBeNull();
  });
});
