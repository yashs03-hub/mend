import { getPhase } from "./recovery-graph";
import type { EcgReading, Phase, Severity, Symptoms, VitalsReading } from "./types";

/**
 * Presentation-layer provenance for every rule id the product can emit.
 *
 * `evaluate()` records which rule fired and writes a rationale sentence, but a
 * `Decision` carries no machine-readable account of *which inputs the rule
 * read* or *where its thresholds came from*. The clinician view has to answer
 * "why did it say that?" without a clinician reading TypeScript, so that
 * account lives here: for each rule id, the fields it inspects and the
 * thresholds it compares them against, each threshold resolved from the same
 * `Phase` the engine used and carrying the same `source` string.
 *
 * This is a mirror, not a second engine. It decides nothing. Every numeric
 * threshold below is derived from `phase.normalEnvelope` exactly as
 * `buildContext()` derives it, or is declared as a literal with an honest
 * note that it is hard-coded. `rule-catalog.test.ts` parses the rule ids out
 * of `red-flag-engine.ts` and `trends.ts` and fails if the two sets ever
 * diverge, so a new rule cannot ship without provenance.
 */

/**
 * The 90% SpO₂ and 90 mmHg systolic lines are written directly into
 * `red-flag-engine.ts` rather than read from a phase envelope, so they cannot
 * borrow the envelope's source string. Saying so is the point of an audit
 * trail.
 */
const LITERAL_SOURCE =
  "Hard-coded constant in lib/clinical/red-flag-engine.ts, not phase-derived. " +
  "Plausible-but-uncited: general post-op physiology. Needs NEWS2/AAOS citation before clinical use.";

const TREND_SOURCE =
  "Fixed per-day rate threshold in lib/clinical/trends.ts, phase-independent by design. " +
  "Plausible-but-uncited: chosen so ordinary day-to-day noise cannot sustain the slope.";

export interface ResolvedThreshold {
  /** e.g. "Tachycardia threshold". */
  label: string;
  /** The number the engine actually compared against. */
  value: string;
  /** How that number was arrived at, in terms of the phase envelope. */
  derivation: string;
  /** Verbatim provenance. Never paraphrased. */
  source: string;
}

export interface ResolvedInput {
  label: string;
  /** The value the rule read, already formatted, or "not reported". */
  value: string;
  /** Where in the check-in payload it came from, e.g. `vitals.hr`. */
  path: string;
  /** False when the field was absent, so the trail can say so plainly. */
  present: boolean;
}

export interface RuleEntry {
  id: string;
  origin: "red-flag-engine" | "trend-engine";
  severity: Severity | "raises green to amber";
  condition: string;
  /** What the rule tests, in one sentence a clinician can check. */
  test: string;
  inputs: readonly InputRef[];
  thresholds: readonly ThresholdRef[];
}

type InputRef =
  | { kind: "day"; label: string }
  | { kind: "symptom"; key: keyof Symptoms; label: string }
  | {
      kind: "vital";
      key: "hr" | "spo2" | "tempC" | "sbp" | "dbp" | "respRate";
      label: string;
      unit: string;
    }
  | { kind: "quality"; label: string }
  | { kind: "ecg"; label: string };

type ThresholdRef = (phase: Phase) => ResolvedThreshold;

const tachycardia: ThresholdRef = (phase) => ({
  label: "Tachycardia threshold",
  value: `${phase.normalEnvelope.hrMax + 10} bpm`,
  derivation: `${phase.name} envelope hrMax (${phase.normalEnvelope.hrMax} bpm) + 10`,
  source: phase.normalEnvelope.source,
});

const peSpo2Floor: ThresholdRef = (phase) => ({
  label: "Pulmonary embolism oxygen floor",
  value: `${phase.normalEnvelope.spo2Min - 2}%`,
  derivation: `${phase.name} envelope spo2Min (${phase.normalEnvelope.spo2Min}%) − 2`,
  source: phase.normalEnvelope.source,
});

const feverMax: ThresholdRef = (phase) => ({
  label: "Expected maximum temperature",
  value: `${phase.normalEnvelope.tempCMax.toFixed(1)} °C`,
  derivation: `${phase.name} envelope tempCMax, read directly`,
  source: phase.normalEnvelope.source,
});

const spo2Critical: ThresholdRef = () => ({
  label: "Critical hypoxia line",
  value: "90%",
  derivation: "Literal 90 in hypoxia.spo2_critical — deliberately not phase-scaled",
  source: LITERAL_SOURCE,
});

const sbpFloor: ThresholdRef = () => ({
  label: "Systolic floor",
  value: "90 mmHg",
  derivation: "Literal 90 in shock.hypotension — deliberately not phase-scaled",
  source: LITERAL_SOURCE,
});

const dislocationSigns: ThresholdRef = () => ({
  label: "Classic-sign count",
  value: "2 of 3",
  derivation: "At least two of sudden severe hip pain, leg shortened/rotated, unable to weight-bear",
  source: LITERAL_SOURCE,
});

const qualityGate: ThresholdRef = () => ({
  label: "Usability gate",
  value: 'quality must be "ok"',
  derivation:
    "usableVitals() strips values from a poor or stale reading before any rule sees them",
  source: LITERAL_SOURCE,
});

const extractionGate: ThresholdRef = () => ({
  label: "Symptom extraction usability gate",
  value: "extraction must succeed",
  derivation:
    "extractSymptoms() must return ok: true from a parseable report_symptoms tool_use; failure means structured symptoms are unknown, not empty",
  source:
    "Fail-safe policy in lib/clinical/red-flag-engine.ts (symptoms.extraction_failed): " +
    "never reassure when symptom extraction did not run or failed. " +
    "Parallel to vitals.unusable_no_data.",
});

const trendRate = (label: string, value: string, note: string): ThresholdRef => () => ({
  label,
  value,
  derivation: note,
  source: TREND_SOURCE,
});

const DAY: InputRef = { kind: "day", label: "Post-op day" };
const HR: InputRef = { kind: "vital", key: "hr", label: "Heart rate", unit: "bpm" };
const SPO2: InputRef = { kind: "vital", key: "spo2", label: "Oxygen saturation", unit: "%" };
const TEMP: InputRef = { kind: "vital", key: "tempC", label: "Temperature", unit: "°C" };
const SBP: InputRef = { kind: "vital", key: "sbp", label: "Systolic BP", unit: "mmHg" };
const QUALITY: InputRef = { kind: "quality", label: "Reading quality" };
const ECG: InputRef = { kind: "ecg", label: "KardiaMobile 6L determination" };
const BREATHLESS: InputRef = { kind: "symptom", key: "breathless", label: "Breathless" };
const CHEST_PAIN: InputRef = { kind: "symptom", key: "chestPain", label: "Chest pain" };

const ENTRIES: readonly RuleEntry[] = [
  {
    id: "pe.breathless_with_tachycardia",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected pulmonary embolism",
    test: "Breathlessness or chest pain reported, and heart rate above the day's tachycardia threshold.",
    inputs: [DAY, BREATHLESS, CHEST_PAIN, HR],
    thresholds: [tachycardia],
  },
  {
    id: "pe.breathless_with_low_spo2",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected pulmonary embolism",
    test: "Breathlessness or chest pain reported, and oxygen saturation below the day's PE floor.",
    inputs: [DAY, BREATHLESS, CHEST_PAIN, SPO2],
    thresholds: [peSpo2Floor],
  },
  {
    id: "pe.breathless_with_ecg_tachycardia",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected pulmonary embolism",
    test: "Breathlessness or chest pain reported, and the ECG determination is tachycardia.",
    inputs: [DAY, BREATHLESS, CHEST_PAIN, ECG, HR],
    thresholds: [],
  },
  {
    id: "pe.unusable_vitals_failsafe",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected pulmonary embolism",
    test: "Breathlessness or chest pain reported while the vitals reading cannot be trusted.",
    inputs: [DAY, BREATHLESS, CHEST_PAIN, QUALITY],
    thresholds: [qualityGate],
  },
  {
    id: "hypoxia.spo2_critical",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Hypoxia",
    test: "Oxygen saturation below 90%, whatever the patient reports.",
    inputs: [SPO2],
    thresholds: [spo2Critical],
  },
  {
    id: "shock.hypotension",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected shock / bleeding",
    test: "Systolic blood pressure below 90 mmHg.",
    inputs: [SBP, HR],
    thresholds: [sbpFloor],
  },
  {
    id: "dislocation.classic_triad",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Suspected hip dislocation",
    test: "At least two of the three classic dislocation signs reported.",
    inputs: [
      { kind: "symptom", key: "suddenSevereHipPain", label: "Sudden severe hip pain" },
      { kind: "symptom", key: "legShortenedOrRotated", label: "Leg shortened or rotated" },
      { kind: "symptom", key: "unableToWeightBear", label: "Unable to weight-bear" },
    ],
    thresholds: [dislocationSigns],
  },
  {
    id: "fever.severe",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Severe fever",
    test: "Temperature at or above 39.0 °C, regardless of day or other findings.",
    inputs: [TEMP],
    thresholds: [feverMax],
  },
  {
    id: "fever.persistent",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Persistent fever",
    test: "Temperature above the day's envelope on three consecutive days. Persistence carries information a single reading does not.",
    inputs: [DAY, TEMP],
    thresholds: [feverMax],
  },
  {
    id: "pe.breathless_no_tachycardia",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "New breathlessness or chest pain",
    test: "Breathlessness or chest pain with no corroborating tachycardia or desaturation. Downgrades the urgency, not the concern — a normal heart rate does not exclude a clot.",
    inputs: [DAY, BREATHLESS, CHEST_PAIN, HR],
    thresholds: [tachycardia],
  },
  {
    id: "sepsis.fever_with_tachycardia",
    origin: "red-flag-engine",
    severity: "red",
    condition: "Possible sepsis",
    test: "Temperature above the day's maximum together with heart rate above the day's tachycardia threshold.",
    inputs: [DAY, TEMP, HR, { kind: "symptom", key: "woundDischarge", label: "Wound discharge" }],
    thresholds: [feverMax, tachycardia],
  },
  {
    id: "dvt.calf_pain_or_swelling",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Possible DVT",
    test: "Calf pain or swelling reported.",
    inputs: [{ kind: "symptom", key: "calfPainOrSwelling", label: "Calf pain or swelling" }],
    thresholds: [],
  },
  {
    id: "wound_infection.fever",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Possible wound infection",
    test: "Temperature above the day's expected maximum, without a tachycardia to make it sepsis.",
    inputs: [DAY, TEMP, { kind: "symptom", key: "woundDischarge", label: "Wound discharge" }],
    thresholds: [feverMax],
  },
  {
    id: "wound_infection.discharge",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Possible wound infection",
    test: "Wound discharge reported without a fever.",
    inputs: [{ kind: "symptom", key: "woundDischarge", label: "Wound discharge" }],
    thresholds: [],
  },
  {
    id: "afib.new_atrial_fibrillation",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "New atrial fibrillation",
    test: "The ECG determination is atrial fibrillation.",
    inputs: [ECG, HR],
    thresholds: [],
  },
  {
    id: "pain.uncontrolled",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Uncontrolled pain",
    test: "The patient reports pain is not controlled on the current plan.",
    inputs: [{ kind: "symptom", key: "painControlled", label: "Pain controlled" }],
    thresholds: [],
  },
  {
    id: "confusion.new_onset",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "New confusion",
    test: "New confusion reported since surgery.",
    inputs: [{ kind: "symptom", key: "newConfusion", label: "New confusion" }],
    thresholds: [],
  },
  {
    id: "symptoms.extraction_failed",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Symptom extraction unavailable",
    test: "Symptom extraction did not run or failed, so an empty symptoms object must not be treated as an unremarkable check-in.",
    inputs: [],
    thresholds: [extractionGate],
  },
  {
    id: "vitals.unusable_no_data",
    origin: "red-flag-engine",
    severity: "amber",
    condition: "Vitals unavailable or unreliable",
    test: "No trustworthy vitals were available and no red-flag symptom was reported.",
    inputs: [QUALITY, HR, SPO2, TEMP, SBP],
    thresholds: [qualityGate],
  },
  {
    id: "trend.hr.rising",
    origin: "trend-engine",
    severity: "amber",
    condition: "Resting heart rate climbing",
    test: "Least-squares slope of heart rate over the trailing 7 readings is at or above +3 bpm/day.",
    inputs: [HR],
    thresholds: [
      trendRate("Heart rate slope", "+3 bpm/day", "Regressed over at most 7 trailing readings, minimum 3 points"),
    ],
  },
  {
    id: "trend.spo2.falling",
    origin: "trend-engine",
    severity: "amber",
    condition: "Oxygen saturation falling",
    test: "Least-squares slope of oxygen saturation is at or below −1 %/day.",
    inputs: [SPO2],
    thresholds: [
      trendRate("Oxygen slope", "−1 %/day", "Regressed over at most 7 trailing readings, minimum 3 points"),
    ],
  },
  {
    id: "trend.tempc.rising",
    origin: "trend-engine",
    severity: "amber",
    condition: "Temperature climbing",
    test: "Least-squares slope of temperature is at or above +0.15 °C/day.",
    inputs: [TEMP],
    thresholds: [
      trendRate("Temperature slope", "+0.15 °C/day", "Regressed over at most 7 trailing readings, minimum 3 points"),
    ],
  },
  {
    id: "trend.pain_score.rising",
    origin: "trend-engine",
    severity: "amber",
    condition: "Reported pain climbing",
    test: "Least-squares slope of the reported pain score is at or above +1 point/day.",
    inputs: [{ kind: "symptom", key: "painScore", label: "Pain score" }],
    thresholds: [
      trendRate("Pain slope", "+1 point/day", "Regressed over at most 7 trailing readings, minimum 3 points"),
    ],
  },
  {
    id: "trend.raised_green_to_amber",
    origin: "trend-engine",
    severity: "raises green to amber",
    condition: "Gradual change flagged on trajectory",
    test:
      "Every single reading sat inside the envelope, so the red-flag engine returned green — " +
      "one or more trend findings then raised it to amber. This edge can never lower a level or reach red.",
    inputs: [],
    thresholds: [],
  },
];

const BY_ID = new Map(ENTRIES.map((entry) => [entry.id, entry]));

export const RULE_CATALOG: readonly RuleEntry[] = ENTRIES;

export function ruleEntry(id: string): RuleEntry | undefined {
  return BY_ID.get(id);
}

/**
 * A rule's thresholds resolved against one phase. The rule table on the
 * engine page uses this to show a worked example; the per-patient audit trail
 * gets the same numbers via `auditRule`, resolved against the phase that
 * check-in actually fell in.
 */
export function resolveThresholds(
  entry: RuleEntry,
  phase: Phase,
): ResolvedThreshold[] {
  return entry.thresholds.map((resolve) => resolve(phase));
}

export interface AuditInputs {
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
}

const ECG_LABEL: Record<EcgReading["determination"], string> = {
  normal_sinus_rhythm: "Normal sinus rhythm",
  atrial_fibrillation: "Atrial fibrillation",
  tachycardia: "Tachycardia",
  bradycardia: "Bradycardia",
  unclassified: "Unclassified",
};

function resolveInput(ref: InputRef, ctx: AuditInputs): ResolvedInput {
  switch (ref.kind) {
    case "day":
      return {
        label: ref.label,
        value: String(ctx.dayPostOp),
        path: "dayPostOp",
        present: true,
      };
    case "quality":
      return {
        label: ref.label,
        value: ctx.vitals.quality,
        path: "vitals.quality",
        present: true,
      };
    case "ecg":
      return {
        label: ref.label,
        value: ctx.ecg ? ECG_LABEL[ctx.ecg.determination] : "no ECG on file",
        path: "ecg.determination",
        present: ctx.ecg !== undefined,
      };
    case "vital": {
      const raw = ctx.vitals[ref.key];
      return {
        label: ref.label,
        value:
          raw === undefined
            ? "not recorded"
            : `${ref.key === "tempC" ? raw.toFixed(1) : raw} ${ref.unit}`,
        path: `vitals.${ref.key}`,
        present: raw !== undefined,
      };
    }
    case "symptom": {
      const raw = ctx.symptoms[ref.key];
      if (raw === undefined) {
        return { label: ref.label, value: "not reported", path: `symptoms.${ref.key}`, present: false };
      }
      return {
        label: ref.label,
        value: typeof raw === "number" ? `${raw} / 10` : raw ? "yes" : "no",
        path: `symptoms.${ref.key}`,
        present: true,
      };
    }
  }
}

export interface RuleAudit {
  id: string;
  entry: RuleEntry | undefined;
  inputs: ResolvedInput[];
  thresholds: ResolvedThreshold[];
}

/**
 * Everything needed to justify one fired rule, resolved against the exact
 * inputs of the check-in that fired it and the phase those inputs fell in.
 * An unknown id yields an entry-less audit rather than throwing, so a rule
 * added without a catalogue record degrades to "no provenance recorded"
 * on screen instead of blanking the page.
 */
export function auditRule(id: string, ctx: AuditInputs): RuleAudit {
  const entry = BY_ID.get(id);
  const phase = getPhase(ctx.dayPostOp);

  return {
    id,
    entry,
    inputs: entry ? entry.inputs.map((ref) => resolveInput(ref, ctx)) : [],
    thresholds: entry ? entry.thresholds.map((resolve) => resolve(phase)) : [],
  };
}
