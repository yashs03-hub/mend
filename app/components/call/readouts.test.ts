import { describe, expect, it } from "vitest";
import { getPhase } from "@/lib/clinical/recovery-graph";
import type { Decision } from "@/lib/clinical/types";
import {
  bpStatus,
  callTarget,
  hrStatus,
  parseDecision,
  parseVitalsRow,
  sourceLabel,
  spo2Status,
  tempStatus,
} from "./readouts";

const phase = getPhase(4); // Early protected: hrMax 100, spo2Min 94, tempCMax 38.0

describe("hrStatus", () => {
  it("is in range up to the phase maximum", () => {
    expect(hrStatus(76, phase)?.level).toBe("green");
    expect(hrStatus(100, phase)?.level).toBe("green");
  });

  it("is amber above the envelope but below the engine's tachycardia line", () => {
    expect(hrStatus(101, phase)?.level).toBe("amber");
    expect(hrStatus(110, phase)?.level).toBe("amber");
  });

  it("is red once the engine would call it tachycardia", () => {
    expect(hrStatus(111, phase)?.level).toBe("red");
    expect(hrStatus(122, phase)?.level).toBe("red");
  });

  it("always carries a text label and the bound it was judged against", () => {
    const status = hrStatus(122, phase);
    expect(status?.label).toBe("Above range");
    expect(status?.envelope).toBe("expected ≤ 100 bpm");
  });

  it("reports nothing rather than guessing when the reading is missing", () => {
    expect(hrStatus(undefined, phase)).toBeUndefined();
  });
});

describe("spo2Status", () => {
  it("is in range at or above the phase minimum", () => {
    expect(spo2Status(97, phase)?.level).toBe("green");
    expect(spo2Status(94, phase)?.level).toBe("green");
  });

  it("is amber in the two points below the envelope", () => {
    expect(spo2Status(93, phase)?.level).toBe("amber");
    expect(spo2Status(92, phase)?.level).toBe("amber");
  });

  it("is red at the engine's PE floor and at critical hypoxia", () => {
    expect(spo2Status(91, phase)?.level).toBe("red");
    expect(spo2Status(89, phase)?.level).toBe("red");
  });
});

describe("tempStatus", () => {
  it("never reaches red, because no engine rule reds on temperature alone", () => {
    expect(tempStatus(36.9, phase)?.level).toBe("green");
    expect(tempStatus(38.0, phase)?.level).toBe("green");
    expect(tempStatus(39.5, phase)?.level).toBe("amber");
  });
});

describe("bpStatus", () => {
  it("reds only below the engine's shock threshold", () => {
    expect(bpStatus(122)?.level).toBe("green");
    expect(bpStatus(90)?.level).toBe("green");
    expect(bpStatus(88)?.level).toBe("red");
  });
});

const redDecision: Decision = {
  level: "red",
  condition: "Suspected pulmonary embolism",
  action: "Call 911 now.",
  call: "911",
  rationale: ["Breathlessness reported with heart rate 122."],
  firedRules: ["pe.breathless_with_tachycardia"],
};

describe("callTarget", () => {
  it("dials emergency services on a 911 decision", () => {
    const target = callTarget(redDecision);
    expect(target.buttonLabel).toBe("Call 911");
    expect(target.href).toBe("tel:911");
    expect(target.imperative).toBe("Hang up and call 911 now.");
  });

  it("falls back to the engine's own action when there is no call target", () => {
    const target = callTarget({ ...redDecision, call: undefined });
    expect(target.imperative).toBe("Call 911 now.");
    expect(target.href).toBeUndefined();
  });
});

describe("parseDecision", () => {
  it("accepts a well-formed decision payload", () => {
    expect(parseDecision(JSON.parse(JSON.stringify(redDecision)))).toEqual(redDecision);
  });

  it("rejects an unknown severity rather than painting it on the stage", () => {
    expect(parseDecision({ ...redDecision, level: "purple" })).toBeUndefined();
  });

  it("rejects a decision with no action to speak", () => {
    expect(parseDecision({ ...redDecision, action: "  " })).toBeUndefined();
    expect(parseDecision(null)).toBeUndefined();
    expect(parseDecision([redDecision])).toBeUndefined();
  });

  it("drops a call target it does not recognise", () => {
    expect(parseDecision({ ...redDecision, call: "pager" })?.call).toBeUndefined();
  });
});

describe("parseVitalsRow", () => {
  it("maps a realtime row into the clinical shape", () => {
    const reading = parseVitalsRow({
      recorded_at: "2026-07-25T09:12:00.000Z",
      hr: 122,
      sbp: 132,
      dbp: 84,
      temp_c: 37,
      spo2: 91,
      resp_rate: 26,
      source: "ble_heart_rate",
      device_label: "Polar Pacer Pro",
      quality: "ok",
    });

    expect(reading).toEqual({
      timestamp: "2026-07-25T09:12:00.000Z",
      hr: 122,
      sbp: 132,
      dbp: 84,
      tempC: 37,
      spo2: 91,
      respRate: 26,
      source: "ble_heart_rate",
      deviceLabel: "Polar Pacer Pro",
      quality: "ok",
    });
  });

  it("omits null columns instead of turning them into zeroes", () => {
    const reading = parseVitalsRow({
      recorded_at: "2026-07-25T09:12:00.000Z",
      hr: 80,
      spo2: null,
      source: "ble_heart_rate",
      quality: "ok",
    });
    expect(reading?.spo2).toBeUndefined();
    expect(reading?.hr).toBe(80);
  });

  it("distrusts an unrecognised quality and an unrecognised source", () => {
    const reading = parseVitalsRow({
      recorded_at: "2026-07-25T09:12:00.000Z",
      source: "guesswork",
      quality: "excellent",
    });
    expect(reading?.quality).toBe("poor");
    expect(reading?.source).toBe("manual");
  });

  it("rejects a row with no timestamp", () => {
    expect(parseVitalsRow({ hr: 80, source: "manual", quality: "ok" })).toBeUndefined();
    expect(parseVitalsRow(undefined)).toBeUndefined();
  });
});

describe("sourceLabel", () => {
  it("prefers the device's own name", () => {
    expect(
      sourceLabel({
        timestamp: "2026-07-25T09:12:00.000Z",
        source: "ble_heart_rate",
        deviceLabel: "Polar Pacer Pro",
        quality: "ok",
      }),
    ).toBe("Polar Pacer Pro");
  });

  it("says plainly when a reading is simulated", () => {
    expect(
      sourceLabel({
        timestamp: "2026-07-25T09:12:00.000Z",
        source: "simulated",
        quality: "ok",
      }),
    ).toBe("Simulated feed");
  });
});
