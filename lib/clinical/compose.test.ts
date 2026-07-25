import { describe, expect, it } from "vitest";
import { composeDecision, TREND_ESCALATION_RULE_ID } from "./compose";
import type { Decision, TrendFinding } from "./types";

function greenDecision(): Decision {
  return {
    level: "green",
    action: "Continue the current recovery plan. No red-flag symptoms or vitals were detected.",
    rationale: ["Day 5 vitals and symptoms are within the expected recovery envelope."],
    firedRules: [],
  };
}

function amberDecision(): Decision {
  return {
    level: "amber",
    condition: "Possible DVT",
    action: "Contact the surgeon's office today for an urgent DVT assessment.",
    call: "surgeon_office",
    rationale: ["Calf pain or swelling reported, a possible sign of deep vein thrombosis."],
    firedRules: ["dvt.calf_pain_or_swelling"],
  };
}

function redDecision(): Decision {
  return {
    level: "red",
    condition: "Suspected pulmonary embolism",
    action: "Call 911 now. This combination can indicate a pulmonary embolism.",
    call: "911",
    rationale: [
      "Breathlessness reported with heart rate 122, more than 10 bpm above the day-4 expected maximum of 100.",
    ],
    firedRules: ["pe.breathless_with_tachycardia"],
  };
}

const hrTrend: TrendFinding = {
  id: "trend.hr.rising",
  metric: "hr",
  severity: "amber",
  description: "Resting heart rate has risen from 60 to 99 bpm over 13 days (+3.0 bpm/day).",
};

const spo2Trend: TrendFinding = {
  id: "trend.spo2.falling",
  metric: "spo2",
  severity: "amber",
  description: "Oxygen saturation has fallen from 97% to 92% over 6 days (-0.8 %/day).",
};

describe("composeDecision — the composition rule", () => {
  it("green with no trend findings stays green, unchanged", () => {
    const decision = greenDecision();
    const result = composeDecision(decision, []);
    expect(result).toEqual(decision);
  });

  it("green with trend findings is RAISED to amber", () => {
    const result = composeDecision(greenDecision(), [hrTrend]);
    expect(result.level).toBe("amber");
  });

  it("raising green to amber records which path set the level in firedRules", () => {
    const result = composeDecision(greenDecision(), [hrTrend]);
    expect(result.firedRules).toContain(TREND_ESCALATION_RULE_ID);
  });

  it("raising green to amber preserves the original decision's rationale and appends trend descriptions", () => {
    const original = greenDecision();
    const result = composeDecision(original, [hrTrend]);
    expect(result.rationale).toEqual([...original.rationale, hrTrend.description]);
  });

  it("multiple trend findings all appear in the composed rationale and condition", () => {
    const result = composeDecision(greenDecision(), [hrTrend, spo2Trend]);
    expect(result.level).toBe("amber");
    expect(result.rationale).toContain(hrTrend.description);
    expect(result.rationale).toContain(spo2Trend.description);
    expect(result.condition).toContain("heart rate");
    expect(result.condition).toContain("oxygen saturation");
  });

  it("amber NEVER moves to red, even with trend findings present — the rule forbids amber->red", () => {
    const decision = amberDecision();
    const result = composeDecision(decision, [hrTrend, spo2Trend]);
    expect(result.level).toBe("amber");
    expect(result).toEqual(decision);
  });

  it("amber with no trend findings is returned completely unchanged", () => {
    const decision = amberDecision();
    const result = composeDecision(decision, []);
    expect(result).toEqual(decision);
  });

  it(
    "BINDING CASE: trends suggest amber but evaluate() already returned red — " +
      "the result must stay red with the red condition intact",
    () => {
      const decision = redDecision();
      const result = composeDecision(decision, [hrTrend, spo2Trend]);

      expect(result.level).toBe("red");
      expect(result.condition).toBe("Suspected pulmonary embolism");
      expect(result.call).toBe("911");
      expect(result).toEqual(decision);
    },
  );

  it("red with no trend findings is returned completely unchanged", () => {
    const decision = redDecision();
    const result = composeDecision(decision, []);
    expect(result).toEqual(decision);
  });

  it("never lowers any level: red stays red, amber stays amber, regardless of finding count", () => {
    for (const decision of [redDecision(), amberDecision()]) {
      const before = decision.level;
      const result = composeDecision(decision, [hrTrend]);
      expect(result.level).toBe(before);
    }
  });

  it("composed amber-from-trend sets a nurse_line call target, a sensible non-911 action", () => {
    const result = composeDecision(greenDecision(), [hrTrend]);
    expect(result.call).toBe("nurse_line");
    expect(result.action).not.toContain("911");
  });
});
