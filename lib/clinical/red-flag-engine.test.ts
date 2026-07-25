import { describe, it, expect } from "vitest";
import { evaluate } from "./red-flag-engine";
import { Symptoms, VitalsReading } from "./types";

const ok = (v: Partial<VitalsReading>): VitalsReading => ({
  timestamp: "t",
  quality: "ok", source: "simulated",
  ...v,
});

interface Vignette {
  name: string;
  day: number;
  s: Symptoms;
  v: VitalsReading;
  level: string;
  condition?: string;
  call?: string;
}

const cases: Vignette[] = [
  {
    name: "well patient, normal vitals",
    day: 5,
    s: { painControlled: true },
    v: ok({ hr: 78, tempC: 37.1, sbp: 128, ecgFlags: ["normal"] }),
    level: "green",
  },
  {
    name: "low-grade temp within early envelope stays green",
    day: 2,
    s: {},
    v: ok({ hr: 92, tempC: 37.8 }),
    level: "green",
  },
  {
    name: "same temp later trips amber (tighter envelope)",
    day: 21,
    s: {},
    v: ok({ tempC: 37.8, hr: 84 }),
    level: "amber",
    condition: "Possible wound infection",
  },
  {
    name: "PE: breathless + tachycardia corroborated by ECG",
    day: 4,
    s: { breathless: true },
    v: ok({ hr: 122, ecgFlags: ["sinus_tachycardia"] }),
    level: "red",
    condition: "Suspected pulmonary embolism",
    call: "911",
  },
  {
    name: "shock: hypotension + tachycardia",
    day: 1,
    s: {},
    v: ok({ sbp: 84, hr: 118 }),
    level: "red",
    condition: "Suspected shock / bleeding",
    call: "911",
  },
  {
    name: "dislocation: sudden pain + shortened rotated leg",
    day: 10,
    s: {
      suddenSevereHipPain: true,
      legShortenedOrRotated: true,
      unableToWeightBear: true,
    },
    v: ok({ hr: 96 }),
    level: "red",
    condition: "Suspected hip dislocation",
    call: "911",
  },
  {
    name: "sepsis: high fever + marked tachycardia",
    day: 6,
    s: { woundDischarge: true },
    v: ok({ tempC: 38.9, hr: 124 }),
    level: "red",
    condition: "Possible sepsis",
    call: "ER",
  },
  {
    name: "DVT: calf swelling, no chest signs -> urgent same-day",
    day: 8,
    s: { calfPainOrSwelling: true },
    v: ok({ hr: 88, tempC: 37.0 }),
    level: "amber",
    condition: "Possible DVT",
    call: "surgeon_office",
  },
  {
    name: "uncontrolled pain -> amber",
    day: 3,
    s: { painControlled: false },
    v: ok({ hr: 96 }),
    level: "amber",
    condition: "Uncontrolled pain",
  },
  {
    name: "fail-safe: breathless but vitals unusable -> escalate not reassure",
    day: 4,
    s: { breathless: true },
    v: { timestamp: "t", quality: "poor", source: "simulated" },
    level: "red",
    condition: "Suspected pulmonary embolism",
    call: "911",
  },
  {
    name: "new AF while stable -> amber nurse line",
    day: 9,
    s: {},
    v: ok({ hr: 96, ecgFlags: ["new_af"] }),
    level: "amber",
    condition: "New atrial fibrillation",
    call: "nurse_line",
  },
  {
    name: "new confusion -> amber (delirium is a red flag in this cohort)",
    day: 3,
    s: { newConfusion: true },
    v: ok({ hr: 84, tempC: 37.0 }),
    level: "amber",
    condition: "New confusion",
  },
  {
    name: "chest pain alone with unusable vitals still escalates",
    day: 7,
    s: { chestPain: true },
    v: { timestamp: "t", quality: "stale", source: "simulated" },
    level: "red",
    condition: "Suspected pulmonary embolism",
    call: "911",
  },
  {
    name: "red outranks amber when both would fire",
    day: 6,
    s: { breathless: true, calfPainOrSwelling: true, painControlled: false },
    v: ok({ hr: 130 }),
    level: "red",
    condition: "Suspected pulmonary embolism",
  },
];

describe("evaluate", () => {
  for (const c of cases) {
    it(c.name, () => {
      const d = evaluate({ dayPostOp: c.day, symptoms: c.s, vitals: c.v });
      expect(d.level).toBe(c.level);
      if (c.condition) expect(d.condition).toBe(c.condition);
      if (c.call) expect(d.call).toBe(c.call);
    });
  }

  it("always returns at least one rationale, whatever the verdict", () => {
    for (const c of cases) {
      const d = evaluate({ dayPostOp: c.day, symptoms: c.s, vitals: c.v });
      expect(d.rationale.length).toBeGreaterThan(0);
      expect(d.action.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic — identical input yields identical output", () => {
    const input = {
      dayPostOp: 4,
      symptoms: { breathless: true },
      vitals: ok({ hr: 122 }),
    };
    expect(evaluate(input)).toEqual(evaluate(input));
  });

  it("never returns green when any red-flag symptom is present", () => {
    const redFlagSymptoms: Symptoms[] = [
      { breathless: true },
      { chestPain: true },
      { calfPainOrSwelling: true },
      { woundDischarge: true },
      { newConfusion: true },
      { painControlled: false },
    ];
    for (const s of redFlagSymptoms) {
      const d = evaluate({ dayPostOp: 5, symptoms: s, vitals: ok({ hr: 80 }) });
      expect(d.level).not.toBe("green");
    }
  });

  it("green requires a usable reading — silence plus no symptoms is not reassurance", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: {},
      vitals: { timestamp: "t", quality: "stale", source: "simulated" },
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("No usable readings");
  });
});
