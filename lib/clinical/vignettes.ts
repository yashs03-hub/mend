import { evaluate } from "./red-flag-engine";
import type { Decision, EcgReading, Severity, Symptoms, VitalsReading } from "./types";

/**
 * The red-flag vignette suite, in a form that can be executed outside vitest.
 *
 * These are the same cases asserted in `red-flag-engine.test.ts` — the binding
 * table from task-4-brief.md, plus the safety edges and threshold boundaries
 * that file adds. They are restated here rather than imported because vitest
 * assertions are not values: `scripts/export-vignettes.ts` has to be able to
 * run every case through `evaluate()` and record what actually came back,
 * including a failure, which an `expect()` call cannot do.
 *
 * Restating them creates one risk — this table drifting away from the engine's
 * real rule set. `vignettes.test.ts` closes it by parsing the rule ids out of
 * `red-flag-engine.ts` and asserting that every id this table expects is one
 * the engine can actually emit.
 *
 * `red-flag-engine.ts` and `red-flag-engine.test.ts` are DO-NOT-MODIFY. This
 * file is additive and must stay that way: if a vignette here disagrees with
 * the engine, the vignette is what is wrong, and the engine page is supposed
 * to show that in red rather than quietly correct it.
 */

export type VignetteGroup =
  | "Binding vignette table"
  | "Safety edges and threshold boundaries";

export interface Vignette {
  /** Stable identifier, matching the numbering in red-flag-engine.test.ts. */
  name: string;
  group: VignetteGroup;
  day: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  expected: {
    level: Severity;
    /** Asserted only when the source test asserts it. */
    condition?: string;
    /** Asserted only when the source test asserts exact rule ids. */
    firedRules?: string[];
  };
  /** Why this case exists, in one line, for the engine page. */
  note: string;
}

const AT = "2026-07-25T12:00:00.000Z";

function vitals(partial: Partial<VitalsReading> = {}): VitalsReading {
  return { timestamp: AT, source: "manual", quality: "ok", ...partial };
}

function ecg(determination: EcgReading["determination"]): EcgReading {
  return { recordedAt: AT, determination, source: "kardia_6l" };
}

const TABLE: VignetteGroup = "Binding vignette table";
const EDGES: VignetteGroup = "Safety edges and threshold boundaries";

export const VIGNETTES: readonly Vignette[] = [
  {
    name: "1",
    group: TABLE,
    day: 5,
    symptoms: { painControlled: true },
    vitals: vitals({ hr: 78, tempC: 37.1, sbp: 128, spo2: 97 }),
    expected: { level: "green" },
    note: "Unremarkable day-5 check-in. Nothing fires and no condition is named.",
  },
  {
    name: "2",
    group: TABLE,
    day: 2,
    symptoms: {},
    vitals: vitals({ hr: 92, tempC: 37.8 }),
    expected: { level: "green" },
    note: "HR 92 and 37.8 °C are both inside the early-protected envelope. Post-op warmth is not a fever.",
  },
  {
    name: "3",
    group: TABLE,
    day: 21,
    symptoms: {},
    vitals: vitals({ tempC: 37.8, hr: 84 }),
    expected: { level: "amber", condition: "Possible wound infection" },
    note: "The same 37.8 °C on day 21, where the envelope has tightened to 37.5 °C, is now a fever.",
  },
  {
    name: "4",
    group: TABLE,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ hr: 122, spo2: 91 }),
    expected: { level: "red", condition: "Suspected pulmonary embolism" },
    note: "The headline escalation: breathlessness with tachycardia on day 4.",
  },
  {
    name: "5",
    group: TABLE,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ hr: 122 }),
    ecg: ecg("tachycardia"),
    expected: {
      level: "red",
      condition: "Suspected pulmonary embolism",
      firedRules: ["pe.breathless_with_tachycardia"],
    },
    note: "HR 122 already clears the day-4 threshold, so the vitals rule fires before the ECG rule is reached.",
  },
  {
    name: "5b",
    group: TABLE,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ hr: 90 }),
    ecg: ecg("tachycardia"),
    expected: {
      level: "red",
      condition: "Suspected pulmonary embolism",
      firedRules: ["pe.breathless_with_ecg_tachycardia"],
    },
    note: "HR 90 is under the threshold, so this is the case that genuinely exercises the ECG-only PE rule.",
  },
  {
    name: "6",
    group: TABLE,
    day: 4,
    symptoms: {},
    vitals: vitals({ spo2: 88, hr: 96 }),
    expected: { level: "red", condition: "Hypoxia" },
    note: "SpO₂ below 90% escalates on the number alone, with no symptom reported.",
  },
  {
    name: "7",
    group: TABLE,
    day: 1,
    symptoms: {},
    vitals: vitals({ sbp: 84, hr: 118 }),
    expected: { level: "red", condition: "Suspected shock / bleeding" },
    note: "Systolic 84 with a compensating tachycardia: occult bleeding until proven otherwise.",
  },
  {
    name: "8",
    group: TABLE,
    day: 10,
    symptoms: {
      suddenSevereHipPain: true,
      legShortenedOrRotated: true,
      unableToWeightBear: true,
    },
    vitals: vitals({ hr: 96 }),
    expected: { level: "red", condition: "Suspected hip dislocation" },
    note: "Two of the three classic signs are enough; this case reports all three.",
  },
  {
    name: "9",
    group: TABLE,
    day: 6,
    symptoms: { woundDischarge: true },
    vitals: vitals({ tempC: 38.9, hr: 124 }),
    expected: { level: "red", condition: "Possible sepsis" },
    note: "Fever and tachycardia together are sepsis, not the amber wound-infection rule below it.",
  },
  {
    name: "10",
    group: TABLE,
    day: 8,
    symptoms: { calfPainOrSwelling: true },
    vitals: vitals({ hr: 88, tempC: 37.0 }),
    expected: { level: "amber", condition: "Possible DVT" },
    note: "Calf pain with entirely normal vitals still earns a same-day assessment.",
  },
  {
    name: "11",
    group: TABLE,
    day: 3,
    symptoms: { painControlled: false },
    vitals: vitals({ hr: 96 }),
    expected: { level: "amber", condition: "Uncontrolled pain" },
    note: "A symptom-only amber: the patient's own report of failed pain control.",
  },
  {
    name: "12",
    group: TABLE,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ quality: "poor" }),
    expected: { level: "red", condition: "Suspected pulmonary embolism" },
    note: "Fail-safe: breathlessness with unreadable vitals escalates rather than assuming the reading was fine.",
  },
  {
    name: "13",
    group: TABLE,
    day: 7,
    symptoms: {},
    vitals: vitals({ hr: 88 }),
    ecg: ecg("atrial_fibrillation"),
    expected: { level: "amber", condition: "New atrial fibrillation" },
    note: "The KardiaMobile determination is consumed as-is; Mend never re-reads the trace.",
  },
  {
    name: "14",
    group: TABLE,
    day: 5,
    symptoms: { newConfusion: true },
    vitals: vitals({ hr: 90 }),
    expected: { level: "amber", condition: "New confusion" },
    note: "New confusion after hip surgery is a delirium screen, not a wait-and-see.",
  },
  {
    name: "15",
    group: TABLE,
    day: 5,
    symptoms: { painControlled: true },
    vitals: vitals({ hr: 78, spo2: 97 }),
    expected: { level: "green", firedRules: [] },
    note: "Green is the absence of a fired rule, never a rule firing favourably.",
  },

  {
    name: "E1",
    group: EDGES,
    day: 5,
    symptoms: {},
    vitals: vitals(),
    expected: { level: "amber", condition: "Vitals unavailable or unreliable" },
    note: "Every physiologic field absent with no symptoms: never green, because there was nothing to be reassured by.",
  },
  {
    name: "E2",
    group: EDGES,
    day: 4,
    symptoms: { breathless: true, calfPainOrSwelling: true },
    vitals: vitals({ hr: 122, spo2: 97 }),
    expected: {
      level: "red",
      condition: "Suspected pulmonary embolism",
      firedRules: ["pe.breathless_with_tachycardia"],
    },
    note: "Red and amber both satisfiable: red wins outright and the amber rule never appears in the trace.",
  },
  {
    name: "E3",
    group: EDGES,
    day: 5,
    symptoms: {},
    vitals: vitals({ hr: 78, spo2: 97 }),
    ecg: ecg("unclassified"),
    expected: { level: "green", firedRules: [] },
    note: "An unclassified ECG is treated as absent — never guessed at as AF or tachycardia.",
  },
  {
    name: "E4",
    group: EDGES,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ hr: 110 }),
    expected: { level: "green" },
    note: "Exactly at the day-4 tachycardia threshold of 110. The test is strictly greater-than, so nothing fires.",
  },
  {
    name: "E5",
    group: EDGES,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ hr: 111 }),
    expected: {
      level: "red",
      condition: "Suspected pulmonary embolism",
      firedRules: ["pe.breathless_with_tachycardia"],
    },
    note: "One beat over the same threshold. The rationale must cite 110, the number that actually governed it.",
  },
  {
    name: "E6",
    group: EDGES,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ spo2: 92 }),
    expected: { level: "green" },
    note: "Exactly at the day-4 PE oxygen floor of 92%, and still at or above the hard 90% hypoxia line.",
  },
  {
    name: "E7",
    group: EDGES,
    day: 4,
    symptoms: { breathless: true },
    vitals: vitals({ spo2: 91 }),
    expected: {
      level: "red",
      condition: "Suspected pulmonary embolism",
      firedRules: ["pe.breathless_with_low_spo2"],
    },
    note: "One point under the floor. Still above 90%, so this is the PE rule and not isolated hypoxia.",
  },
];

/**
 * One executed vignette, in the shape `public/vignettes.json` ships and the
 * engine page renders. `actual` is whatever `evaluate()` returned — including
 * when that disagrees with `expected`, which is the entire reason this exists
 * as data rather than as a green tick.
 */
export interface VignetteResult {
  name: string;
  group: VignetteGroup;
  day: number;
  note: string;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  expected: Vignette["expected"];
  actual: {
    level: Severity;
    condition?: string;
    action: string;
    call?: Decision["call"];
    rationale: string[];
    firedRules: string[];
  };
  pass: boolean;
  /** Human-readable reasons `pass` is false. Empty when it passed. */
  mismatches: string[];
}

function compare(vignette: Vignette, actual: Decision): string[] {
  const mismatches: string[] = [];

  if (actual.level !== vignette.expected.level) {
    mismatches.push(`expected level ${vignette.expected.level}, got ${actual.level}`);
  }
  if (
    vignette.expected.condition !== undefined &&
    actual.condition !== vignette.expected.condition
  ) {
    mismatches.push(
      `expected condition "${vignette.expected.condition}", got "${actual.condition ?? "none"}"`,
    );
  }
  if (vignette.expected.firedRules !== undefined) {
    const want = vignette.expected.firedRules.join(", ") || "none";
    const got = actual.firedRules.join(", ") || "none";
    if (want !== got) {
      mismatches.push(`expected fired rules [${want}], got [${got}]`);
    }
  }

  return mismatches;
}

/**
 * Runs every vignette through the real `evaluate()` and records what came
 * back. Pure and network-free, so the exporter, the tests and anything else
 * see identical results.
 */
export function runVignettes(
  vignettes: readonly Vignette[] = VIGNETTES,
): VignetteResult[] {
  return vignettes.map((vignette) => {
    const actual = evaluate({
      dayPostOp: vignette.day,
      symptoms: vignette.symptoms,
      vitals: vignette.vitals,
      ecg: vignette.ecg,
    });
    const mismatches = compare(vignette, actual);

    return {
      name: vignette.name,
      group: vignette.group,
      day: vignette.day,
      note: vignette.note,
      symptoms: vignette.symptoms,
      vitals: vignette.vitals,
      ecg: vignette.ecg,
      expected: vignette.expected,
      actual: {
        level: actual.level,
        condition: actual.condition,
        action: actual.action,
        call: actual.call,
        rationale: actual.rationale,
        firedRules: actual.firedRules,
      },
      pass: mismatches.length === 0,
      mismatches,
    };
  });
}
