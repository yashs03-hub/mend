import { Severity, Symptoms, VitalsReading } from "@/lib/clinical/types";

/**
 * A SECOND, INDEPENDENT statement of the same clinical intent.
 *
 * This exists to disagree with `evaluate()`. It is deliberately written in a
 * different shape — a scored predicate table rather than an ordered if-chain —
 * so that a mistake in one is unlikely to be mirrored in the other. Where the
 * two disagree, one of them is wrong and a human has to say which.
 *
 * ⚠️ WHAT THIS IS NOT: external validation. Both this file and the engine were
 * written by the same author from the same understanding, so agreement between
 * them is evidence of internal consistency and nothing more. It cannot tell you
 * the thresholds are clinically correct — only `docs/CLINICAL_SOURCES.md` being
 * filled in and signed off can do that.
 *
 * This is differential testing. It is genuinely good at finding bugs and
 * genuinely incapable of proving their absence.
 */

interface RubricRule {
  id: string;
  severity: Severity;
  /** Higher wins when several fire. */
  weight: number;
  applies: (ctx: RubricContext) => boolean;
  because: string;
}

interface RubricContext {
  dayPostOp: number;
  s: Symptoms;
  v: VitalsReading;
  /** Whether we have any physiologic number we can trust. */
  measured: boolean;
  /** Temp ceiling that counts as unremarkable at this stage. */
  tempCeiling: number;
}

/**
 * Phase envelope restated from the clinical intent rather than imported, so a
 * change to the graph does not silently propagate into the rubric and hide a
 * disagreement.
 */
function tempCeilingFor(day: number): number {
  return day <= 13 ? 38.0 : 37.5;
}

const RULES: RubricRule[] = [
  // ---- Immediately life-threatening ----
  {
    id: "pe-corroborated",
    severity: "red",
    weight: 100,
    applies: ({ s, v, measured }) =>
      Boolean(s.breathless || s.chestPain) &&
      (!measured ||
        (v.hr !== undefined && v.hr > 110) ||
        Boolean(v.ecgFlags?.includes("sinus_tachycardia"))),
    because:
      "Respiratory symptom with tachycardia, or with no measurement able to argue against it",
  },
  {
    id: "shock",
    severity: "red",
    weight: 95,
    applies: ({ v }) =>
      v.sbp !== undefined && v.sbp < 90 && v.hr !== undefined && v.hr > 110,
    because: "Hypotension with compensatory tachycardia",
  },
  {
    id: "dislocation",
    severity: "red",
    weight: 90,
    applies: ({ s }) =>
      Boolean(s.suddenSevereHipPain) &&
      Boolean(s.legShortenedOrRotated || s.unableToWeightBear),
    because: "Mechanical failure pattern of the prosthesis",
  },
  {
    id: "sepsis",
    severity: "red",
    weight: 85,
    applies: ({ v }) =>
      v.tempC !== undefined &&
      v.tempC >= 38.5 &&
      v.hr !== undefined &&
      v.hr > 120,
    because: "Pyrexia with marked tachycardia",
  },

  // ---- Urgent, same day ----
  {
    id: "respiratory-uncorroborated",
    severity: "amber",
    weight: 70,
    applies: ({ s }) => Boolean(s.breathless || s.chestPain),
    because:
      "Respiratory symptom without corroboration — a normal heart rate does not exclude a clot",
  },
  {
    id: "dvt",
    severity: "amber",
    weight: 65,
    applies: ({ s }) => Boolean(s.calfPainOrSwelling),
    because: "Calf signs suggestive of deep vein thrombosis",
  },
  {
    id: "wound",
    severity: "amber",
    weight: 60,
    applies: ({ s, v, tempCeiling }) =>
      Boolean(s.woundDischarge) ||
      (v.tempC !== undefined && v.tempC > tempCeiling),
    because: "Wound discharge, or temperature above the stage-appropriate ceiling",
  },
  {
    id: "new-af",
    severity: "amber",
    weight: 55,
    applies: ({ v }) => Boolean(v.ecgFlags?.includes("new_af")),
    because: "New atrial fibrillation while haemodynamically stable",
  },
  {
    id: "pain",
    severity: "amber",
    weight: 50,
    applies: ({ s }) => s.painControlled === false,
    because: "Analgesia inadequate",
  },
  {
    id: "confusion",
    severity: "amber",
    weight: 45,
    applies: ({ s }) => Boolean(s.newConfusion),
    because: "New confusion — a common presentation of something else in this cohort",
  },
  {
    id: "unmeasured",
    severity: "amber",
    weight: 10,
    applies: ({ measured }) => !measured,
    because: "No trustworthy measurement — silence is not a normal result",
  },
];

export interface RubricVerdict {
  severity: Severity;
  firedRuleIds: string[];
  because: string[];
}

export function rubricSeverity(input: {
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
}): RubricVerdict {
  const v = input.vitals;

  // Restated independently of vitals.ts, for the same reason as the envelope.
  const trustworthy = v.quality === "ok";
  const inRange = (n: number | undefined, lo: number, hi: number) =>
    n !== undefined && n >= lo && n <= hi ? n : undefined;

  const clean: VitalsReading = trustworthy
    ? {
        timestamp: v.timestamp,
        quality: v.quality,
        source: v.source,
        hr: inRange(v.hr, 20, 250),
        sbp: inRange(v.sbp, 50, 260),
        dbp: inRange(v.dbp, 20, 160),
        tempC: inRange(v.tempC, 30, 43),
        ecgFlags: v.ecgFlags,
      }
    : { timestamp: v.timestamp, quality: v.quality, source: v.source, ecgFlags: v.ecgFlags };

  const ctx: RubricContext = {
    dayPostOp: input.dayPostOp,
    s: input.symptoms,
    v: clean,
    measured:
      trustworthy &&
      (clean.hr !== undefined ||
        clean.sbp !== undefined ||
        clean.tempC !== undefined),
    tempCeiling: tempCeilingFor(input.dayPostOp),
  };

  const fired = RULES.filter((r) => r.applies(ctx)).sort(
    (a, b) => b.weight - a.weight,
  );

  if (fired.length === 0) {
    return { severity: "green", firedRuleIds: [], because: ["Nothing fired"] };
  }

  return {
    severity: fired[0].severity,
    firedRuleIds: fired.map((r) => r.id),
    because: fired.map((r) => r.because),
  };
}
