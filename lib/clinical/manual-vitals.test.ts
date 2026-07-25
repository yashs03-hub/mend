import { describe, expect, it } from "vitest";
import { plausibilityError, validateManualVitals } from "./vitals";

describe("plausibilityError", () => {
  it("returns null inside the envelope", () => {
    expect(plausibilityError("spo2", 97)).toBeNull();
    expect(plausibilityError("tempC", 36.8)).toBeNull();
  });

  it("names the field and range when out of bounds", () => {
    expect(plausibilityError("spo2", 40)).toMatch(/SpO₂.*50.*100/);
    expect(plausibilityError("sbp", 300)).toMatch(/Systolic BP.*50.*260/);
  });
});

describe("validateManualVitals", () => {
  it("accepts a complete plausible reading", () => {
    const result = validateManualVitals({
      spo2: 97,
      sbp: 122,
      dbp: 78,
      tempC: 36.9,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("allows partial entry", () => {
    expect(validateManualVitals({ spo2: 94 }).ok).toBe(true);
  });

  it("surfaces inline errors for implausible values", () => {
    const result = validateManualVitals({ spo2: 120, tempC: 20 });
    expect(result.ok).toBe(false);
    expect(result.errors.spo2).toBeTruthy();
    expect(result.errors.tempC).toBeTruthy();
  });

  it("rejects systolic ≤ diastolic", () => {
    const result = validateManualVitals({ sbp: 80, dbp: 90 });
    expect(result.ok).toBe(false);
    expect(result.errors.sbp).toMatch(/greater than diastolic/i);
  });
});
