import { describe, expect, it } from "vitest";
import { getPhase } from "../clinical/recovery-graph";
import { evaluate } from "../clinical/red-flag-engine";
import { evaluateTrends } from "../clinical/trends";
import type { Symptoms } from "../clinical/types";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "./fixtures";

// Every scenario in this suite deliberately stays within the "Early
// protected" phase (day 0-13) so a single fixed phase can be used to check
// "inside the envelope" throughout.
const phase = getPhase(5);

const NOW = new Date("2026-07-25T08:00:00.000Z");

/**
 * Asserts `value` is defined via an explicit `expect(...).toBeDefined()`
 * (so a fixture mistake shows up as a normal test failure), then narrows to
 * the non-undefined type through a runtime check — never a `!` non-null
 * assertion or an `as` cast.
 */
function defined<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  if (value === undefined) {
    throw new Error("expected value to be defined");
  }
  return value;
}

describe("scenarioVitals", () => {
  it("green sits within the phase envelope and evaluate() returns green", () => {
    const vitals = scenarioVitals("green", NOW);

    expect(vitals.source).toBe("simulated");
    expect(vitals.timestamp).toBe(NOW.toISOString());
    expect(defined(vitals.hr)).toBeLessThan(phase.normalEnvelope.hrMax);
    expect(defined(vitals.spo2)).toBeGreaterThanOrEqual(phase.normalEnvelope.spo2Min);
    expect(defined(vitals.tempC)).toBeLessThanOrEqual(phase.normalEnvelope.tempCMax);

    const decision = evaluate({ dayPostOp: 4, symptoms: {}, vitals });
    expect(decision.level).toBe("green");
  });

  it("pe breaches: breathless + tachycardic vitals fire the PE red rule", () => {
    const vitals = scenarioVitals("pe", NOW);

    expect(vitals.source).toBe("simulated");
    expect(vitals.hr).toBe(122);
    expect(vitals.spo2).toBe(91);

    const decision = evaluate({
      dayPostOp: 6,
      symptoms: { breathless: true },
      vitals,
    });
    expect(decision.level).toBe("red");
    expect(decision.condition).toBe("Suspected pulmonary embolism");
  });

  it("drift's current reading also sits inside the envelope on its own", () => {
    const vitals = scenarioVitals("drift", NOW);

    expect(vitals.source).toBe("simulated");
    expect(defined(vitals.hr)).toBeLessThan(phase.normalEnvelope.hrMax);

    const decision = evaluate({ dayPostOp: 13, symptoms: {}, vitals });
    expect(decision.level).toBe("green");
  });
});

describe("scenarioHistory", () => {
  it("returns 14 trailing readings for every scenario, all marked simulated", () => {
    for (const scenario of ["green", "pe", "drift"] as const) {
      const history = scenarioHistory(scenario);
      expect(history).toHaveLength(14);
      for (const r of history) {
        expect(r.source).toBe("simulated");
      }
    }
  });

  it("history timestamps are strictly increasing (oldest first)", () => {
    for (const scenario of ["green", "pe", "drift"] as const) {
      const history = scenarioHistory(scenario);
      for (let i = 1; i < history.length; i++) {
        expect(Date.parse(history[i].timestamp)).toBeGreaterThan(
          Date.parse(history[i - 1].timestamp),
        );
      }
    }
  });

  it("green history is flat and inside the envelope on every reading", () => {
    const history = scenarioHistory("green");
    for (const r of history) {
      expect(defined(r.hr)).toBeLessThan(phase.normalEnvelope.hrMax);
      expect(defined(r.spo2)).toBeGreaterThanOrEqual(phase.normalEnvelope.spo2Min);
      expect(defined(r.tempC)).toBeLessThanOrEqual(phase.normalEnvelope.tempCMax);
    }

    const symptoms: Symptoms[] = history.map(() => ({}));
    expect(evaluateTrends(history, symptoms, phase)).toEqual([]);
  });

  it("drift: every single reading sits inside the phase envelope (no breach)", () => {
    const history = scenarioHistory("drift");
    for (const r of history) {
      expect(defined(r.hr)).toBeLessThan(phase.normalEnvelope.hrMax);
      expect(defined(r.spo2)).toBeGreaterThanOrEqual(phase.normalEnvelope.spo2Min);
      expect(defined(r.tempC)).toBeLessThanOrEqual(phase.normalEnvelope.tempCMax);
    }
  });

  it("drift: HR rises across the series (the trajectory the demo relies on)", () => {
    const history = scenarioHistory("drift");
    const hrs = history.map((r) => defined(r.hr));
    for (let i = 1; i < hrs.length; i++) {
      expect(hrs[i]).toBeGreaterThanOrEqual(hrs[i - 1]);
    }
    expect(hrs[hrs.length - 1]).toBeGreaterThan(hrs[0]);
  });

  it("drift: no single reading trips the red-flag engine, only the trend engine catches it", () => {
    const history = scenarioHistory("drift");
    const symptoms: Symptoms[] = history.map(() => ({}));

    for (const r of history) {
      const decision = evaluate({ dayPostOp: 13, symptoms: {}, vitals: r });
      expect(decision.level).toBe("green");
    }

    const findings = evaluateTrends(history, symptoms, phase);
    expect(
      findings.some((f) => f.metric === "hr" && f.severity === "amber"),
    ).toBe(true);
  });

  it("pe history's most recent reading matches the acute breathless event", () => {
    const history = scenarioHistory("pe");
    const latest = history[history.length - 1];
    expect(latest.hr).toBe(122);
    expect(latest.spo2).toBe(91);
  });
});

describe("scenarioEcg", () => {
  it("green -> normal sinus rhythm, pe -> tachycardia, drift -> normal sinus rhythm", () => {
    expect(scenarioEcg("green").determination).toBe("normal_sinus_rhythm");
    expect(scenarioEcg("pe").determination).toBe("tachycardia");
    expect(scenarioEcg("drift").determination).toBe("normal_sinus_rhythm");
  });

  it("every ECG reading uses the kardia_6l source, as the device requires", () => {
    for (const scenario of ["green", "pe", "drift"] as const) {
      expect(scenarioEcg(scenario).source).toBe("kardia_6l");
    }
  });
});
