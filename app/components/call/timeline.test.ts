import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { scriptForDecision } from "@/lib/clinical/scripts";
import { scenarioEcg, scenarioVitals } from "@/lib/sim/fixtures";
import {
  buildTimeline,
  formatCallClock,
  resolveState,
  stageCursor,
  parseStage,
  type CallEvent,
} from "./timeline";

const DAY = 4;
const NOW = new Date("2026-07-25T09:12:00.000Z");

const baselineVitals = scenarioVitals("green", NOW);
const acuteVitals = scenarioVitals("pe", NOW);

const routineDecision = evaluate({
  dayPostOp: DAY,
  symptoms: { painScore: 3, painControlled: true, breathless: false },
  vitals: baselineVitals,
  ecg: scenarioEcg("green"),
});

const escalationDecision = evaluate({
  dayPostOp: DAY,
  symptoms: { breathless: true },
  vitals: acuteVitals,
  ecg: scenarioEcg("pe"),
});

function timeline(): CallEvent[] {
  return buildTimeline({
    dayPostOp: DAY,
    baselineVitals,
    acuteVitals,
    routineDecision,
    escalationDecision,
    escalationScript: scriptForDecision(escalationDecision, "Margaret"),
  });
}

const initial = { decision: routineDecision, vitals: baselineVitals };

describe("the scripted call", () => {
  it("opens green and escalates to red, straight out of the engine", () => {
    expect(routineDecision.level).toBe("green");
    expect(escalationDecision.level).toBe("red");
    expect(escalationDecision.call).toBe("911");
  });

  it("advances in time, never backwards", () => {
    const events = timeline();
    const times = events.map((e) => e.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("pairs every tool result with the call that issued it", () => {
    const events = timeline();
    const startIds = new Set(events.filter((e) => e.kind === "tool-start").map((e) => e.id));
    const results = events.filter((e) => e.kind === "tool-result");
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(startIds.has(result.startId)).toBe(true);
    }
  });

  it("attributes the spoken escalation line to the rule that produced it", () => {
    const events = timeline();
    const spoken = events.find((e) => e.kind === "turn" && e.verbatimFrom !== undefined);
    expect(spoken).toBeDefined();
    expect(spoken?.kind === "turn" && spoken.text).toBe(
      scriptForDecision(escalationDecision, "Margaret"),
    );
    expect(spoken?.kind === "turn" && spoken.verbatimFrom).toBe(
      escalationDecision.firedRules[0],
    );
  });
});

describe("resolveState", () => {
  it("shows nothing at all before the first event", () => {
    const state = resolveState(timeline(), -1, initial);
    expect(state.visible).toEqual([]);
    expect(state.decision.level).toBe("green");
    expect(state.elapsed).toBe(0);
  });

  it("rests on a calm frame: engine answered, every reading at baseline", () => {
    const events = timeline();
    const state = resolveState(events, stageCursor(events, "monitoring"), initial);
    expect(state.decision.level).toBe("green");
    expect(state.vitals.hr).toBe(baselineVitals.hr);
    expect(state.vitals.spo2).toBe(baselineVitals.spo2);
    expect(state.pendingToolId).toBeUndefined();
  });

  it("holds a pending tool call while the engine is being consulted", () => {
    const events = timeline();
    const state = resolveState(events, stageCursor(events, "checking"), initial);
    expect(state.pendingToolId).toBeDefined();
    expect(state.decision.level).toBe("green");
  });

  it("lands on red with the acute reading at the end of the call", () => {
    const events = timeline();
    const state = resolveState(events, stageCursor(events, "escalated"), initial);
    expect(state.decision.level).toBe("red");
    expect(state.decision.firedRules).toEqual(escalationDecision.firedRules);
    expect(state.vitals.hr).toBe(acuteVitals.hr);
    expect(state.vitals.spo2).toBe(acuteVitals.spo2);
    expect(state.pendingToolId).toBeUndefined();
  });

  it("clamps a cursor past the end of the call", () => {
    const events = timeline();
    const state = resolveState(events, 9_999, initial);
    expect(state.visible).toHaveLength(events.length);
  });
});

describe("stageCursor", () => {
  it("orders the three capture frames", () => {
    const events = timeline();
    expect(stageCursor(events, "monitoring")).toBeLessThan(stageCursor(events, "checking"));
    expect(stageCursor(events, "checking")).toBeLessThan(stageCursor(events, "escalated"));
    expect(stageCursor(events, "escalated")).toBe(events.length - 1);
  });

  it("falls back to the end of a call that never escalates", () => {
    const events: CallEvent[] = [
      { kind: "turn", id: "a", at: 1, speaker: "mend", text: "Hello." },
      { kind: "turn", id: "b", at: 4, speaker: "margaret", text: "Hello." },
    ];
    expect(stageCursor(events, "monitoring")).toBe(1);
    expect(stageCursor(events, "checking")).toBe(1);
  });
});

describe("parseStage", () => {
  it("accepts the three named stages and rejects anything else", () => {
    expect(parseStage("monitoring")).toBe("monitoring");
    expect(parseStage("checking")).toBe("checking");
    expect(parseStage("escalated")).toBe("escalated");
    expect(parseStage("red")).toBeUndefined();
    expect(parseStage(undefined)).toBeUndefined();
  });
});

describe("formatCallClock", () => {
  it("pads to mm:ss so the digits never reflow", () => {
    expect(formatCallClock(0)).toBe("00:00");
    expect(formatCallClock(9)).toBe("00:09");
    expect(formatCallClock(62)).toBe("01:02");
    expect(formatCallClock(-5)).toBe("00:00");
  });
});
