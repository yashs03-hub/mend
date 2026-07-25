import { describe, expect, it } from "vitest";
import { composeDecision } from "@/lib/clinical/compose";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluateTrends } from "@/lib/clinical/trends";
import type { Decision } from "@/lib/clinical/types";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "@/lib/sim/fixtures";
import { familyCopy } from "./copy";

const DAY_POST_OP = 4;

function driftDecision() {
  const history = scenarioHistory("drift");
  const findings = evaluateTrends(
    history,
    history.map(() => ({})),
    getPhase(DAY_POST_OP),
  );
  const base = evaluate({
    dayPostOp: DAY_POST_OP,
    symptoms: { painScore: 3, painControlled: true, breathless: false },
    vitals: scenarioVitals("drift", new Date()),
    ecg: scenarioEcg("drift"),
  });
  return { decision: composeDecision(base, findings), findings };
}

describe("familyCopy", () => {
  it("green: one reassuring headline and nothing else", () => {
    const decision = evaluate({
      dayPostOp: DAY_POST_OP,
      symptoms: { painScore: 3, painControlled: true, breathless: false },
      vitals: scenarioVitals("green", new Date()),
      ecg: scenarioEcg("green"),
    });
    expect(decision.level).toBe("green");

    const copy = familyCopy(decision);
    expect(copy.headline).toBe("Mom's doing well today.");
    expect(copy.whatHappened).toBeUndefined();
    expect(copy.whatMendAsked).toBeUndefined();
  });

  it("trend-raised amber: plain drift language, not the clinician description", () => {
    const { decision, findings } = driftDecision();
    expect(decision.level).toBe("amber");

    const copy = familyCopy(decision, findings);
    expect(copy.whatHappened).toContain("heart rate has been creeping up");
    expect(copy.whatHappened).toContain("not an emergency");
    expect(copy.whatMendAsked).toContain("call the nurse line today");
  });

  it("amber copy carries no numbers, thresholds, rule ids or clinical shorthand", () => {
    const { decision, findings } = driftDecision();
    const copy = familyCopy(decision, findings);
    const text = `${copy.headline} ${copy.whatHappened} ${copy.whatMendAsked}`;

    expect(text).not.toMatch(/\d/);
    for (const banned of ["bpm", "SpO2", "spo2", "mmHg", "trend.", "slope", "threshold"]) {
      expect(text).not.toContain(banned);
    }
  });

  it("red: urgent headline, plain reason, and what Mend told her to do", () => {
    const decision = evaluate({
      dayPostOp: DAY_POST_OP,
      symptoms: { breathless: true },
      vitals: scenarioVitals("pe", new Date()),
      ecg: scenarioEcg("pe"),
    });
    expect(decision.level).toBe("red");

    const copy = familyCopy(decision);
    expect(copy.headline).toBe("Mom needs medical help right now.");
    expect(copy.whatHappened).toContain("blood clot in her lung");
    expect(copy.whatMendAsked).toContain("call 911 straight away");
  });

  it("amber conditions from named rules map to third-person plain language", () => {
    const decision = evaluate({
      dayPostOp: DAY_POST_OP,
      symptoms: { calfPainOrSwelling: true },
      vitals: scenarioVitals("green", new Date()),
      ecg: scenarioEcg("green"),
    });
    expect(decision.level).toBe("amber");

    const copy = familyCopy(decision);
    expect(copy.whatHappened).toContain("pain and swelling in her calf");
    expect(copy.whatHappened).toContain("This is not an emergency.");
    expect(copy.whatMendAsked).toContain("surgeon's office");
  });

  it("an unmapped condition falls back rather than leaking engine text", () => {
    const decision: Decision = {
      level: "amber",
      condition: "Some future condition",
      action: "internal action text",
      call: "nurse_line",
      rationale: ["internal rationale"],
      firedRules: ["future.rule_id"],
    };

    const copy = familyCopy(decision);
    expect(copy.whatHappened).toContain("needs a closer look");
    expect(copy.whatHappened).not.toContain("future.rule_id");
    expect(copy.whatHappened).not.toContain("internal");
  });
});
