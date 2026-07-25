import { describe, it, expect } from "vitest";
import { scenarioVitals } from "./vitals-feed";
import { evaluate } from "@/lib/clinical/red-flag-engine";

describe("scenarioVitals", () => {
  it("green scenario is within normal limits", () => {
    const v = scenarioVitals("green", "t");
    expect(v.hr!).toBeLessThan(100);
    expect(v.quality).toBe("ok");
  });

  it("pe scenario shows tachycardia + sinus tach ECG", () => {
    const v = scenarioVitals("pe", "t");
    expect(v.hr!).toBeGreaterThan(110);
    expect(v.ecgFlags).toContain("sinus_tachycardia");
  });

  it("stamps the timestamp it is given", () => {
    expect(scenarioVitals("green", "2026-07-25T09:00:00Z").timestamp).toBe(
      "2026-07-25T09:00:00Z",
    );
  });
});

// The two demo scenarios are load-bearing for the pitch: one must stay green
// through a mild fever, the other must escalate. Assert that end-to-end so a
// later threshold change cannot silently break the demo.
describe("demo scenarios drive the intended verdicts", () => {
  it("day 4 at home, feeling fine -> green", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { painControlled: true },
      vitals: scenarioVitals("green", "t"),
    });
    expect(d.level).toBe("green");
  });

  it("day 9 at home, breathless -> red PE", () => {
    const d = evaluate({
      dayPostOp: 9,
      symptoms: { breathless: true, chestPain: true, calfPainOrSwelling: true },
      vitals: scenarioVitals("pe", "t"),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
    expect(d.call).toBe("911");
  });

  it("fever scenario carries 37.8 C — the number that straddles the envelopes", () => {
    expect(scenarioVitals("fever", "t").tempC).toBe(37.8);
  });

  it("day 4 with a 37.8 fever stays green (the specificity beat)", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: {},
      vitals: scenarioVitals("fever", "t"),
    });
    expect(d.level).toBe("green");
  });

  it("the identical reading on day 21 escalates (the envelope tightens)", () => {
    const d = evaluate({
      dayPostOp: 21,
      symptoms: {},
      vitals: scenarioVitals("fever", "t"),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Possible wound infection");
  });
});
