import { describe, it, expect } from "vitest";
import { usableVitals } from "./vitals";

describe("usableVitals", () => {
  it("passes ok readings through", () => {
    const v = usableVitals({ timestamp: "t", hr: 88, tempC: 37.2, quality: "ok", source: "simulated" });
    expect(v.hr).toBe(88);
    expect(v.tempC).toBe(37.2);
  });

  it("drops physiologic fields when quality is stale", () => {
    const v = usableVitals({ timestamp: "t", hr: 40, tempC: 42, quality: "stale", source: "simulated" });
    expect(v.hr).toBeUndefined();
    expect(v.tempC).toBeUndefined();
  });

  it("drops physiologic fields when quality is poor", () => {
    const v = usableVitals({ timestamp: "t", hr: 88, sbp: 120, quality: "poor", source: "simulated" });
    expect(v.hr).toBeUndefined();
    expect(v.sbp).toBeUndefined();
  });

  it("drops implausible values even when quality says ok", () => {
    const v = usableVitals({ timestamp: "t", hr: 300, tempC: 12, quality: "ok", source: "simulated" });
    expect(v.hr).toBeUndefined();
    expect(v.tempC).toBeUndefined();
  });

  it("keeps plausible siblings when one field is implausible", () => {
    const v = usableVitals({ timestamp: "t", hr: 300, tempC: 37.4, quality: "ok", source: "simulated" });
    expect(v.hr).toBeUndefined();
    expect(v.tempC).toBe(37.4);
  });

  it("preserves ECG flags even on poor quality, so rhythm still informs escalation", () => {
    const v = usableVitals({
      timestamp: "t",
      hr: 122,
      ecgFlags: ["sinus_tachycardia"],
      quality: "poor", source: "simulated",
    });
    expect(v.ecgFlags).toContain("sinus_tachycardia");
  });

  it("never mutates the caller's reading", () => {
    const original = {
      timestamp: "t",
      hr: 300,
      quality: "ok" as const,
      source: "simulated" as const,
    };
    usableVitals(original);
    expect(original.hr).toBe(300);
  });
});
