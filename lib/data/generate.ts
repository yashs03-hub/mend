import { Symptoms, VitalsReading, EcgFlag } from "@/lib/clinical/types";
import { Clause, CLAUSES } from "./phrasings";

/**
 * Deterministic synthetic data generation.
 *
 * Seeded throughout: the same seed always produces the same corpus, so a metric
 * that moves between runs moved because the code changed, not because the dice
 * did. An unseeded generator makes every regression argument unfalsifiable.
 */

/** mulberry32 — small, fast, good enough for data shuffling. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

function sample<T>(r: () => number, xs: T[], n: number): T[] {
  const pool = [...xs];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dataset A — extraction corpus (transcript -> Symptoms)
// ---------------------------------------------------------------------------

export interface ExtractionExample {
  id: string;
  transcript: string;
  /** Ground truth by construction: we chose the meaning before writing the words. */
  gold: Symptoms;
  /** Which clause kinds went into this example — lets you slice metrics. */
  composition: string[];
}

export function generateExtractionCorpus(
  n: number,
  seed = 20260725,
): ExtractionExample[] {
  const r = rng(seed);
  const out: ExtractionExample[] = [];

  for (let i = 0; i < n; i++) {
    // Roughly a third of check-ins in real remote monitoring are unremarkable,
    // and the corpus should not be more alarming than reality.
    const nPositive =
      r() < 0.34 ? 0 : r() < 0.72 ? 1 : r() < 0.92 ? 2 : 3;
    const nNegated = r() < 0.45 ? 1 : 0;
    const nDistractor = r() < 0.3 ? 1 : 0;
    const nFiller = 1 + (r() < 0.5 ? 1 : 0);

    const chosen: Clause[] = [
      ...sample(r, CLAUSES.POSITIVE, nPositive),
      ...sample(r, CLAUSES.NEGATED, nNegated),
      ...sample(r, CLAUSES.DISTRACTOR, nDistractor),
      ...sample(r, CLAUSES.FILLER, nFiller),
    ];

    // Shuffle so the signal is not always in the same position.
    for (let k = chosen.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [chosen[k], chosen[j]] = [chosen[j], chosen[k]];
    }

    const gold: Symptoms = {};
    for (const c of chosen) Object.assign(gold, c.label);

    out.push({
      id: `ext-${String(i).padStart(5, "0")}`,
      transcript: capitalise(chosen.map((c) => c.text).join(". ")) + ".",
      gold,
      composition: chosen.map((c) => c.kind),
    });
  }

  return out;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Dataset B — clinical vignettes (day + symptoms + vitals -> severity)
// ---------------------------------------------------------------------------

export interface Vignette {
  id: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
}

/**
 * The boolean symptom flags only. `painControlled` is tri-state and `painScore`
 * is numeric, so neither can be set by the `= true` sampling below — naming that
 * in the type keeps the two apart instead of relying on the list staying correct.
 */
type BooleanSymptomKey = Exclude<keyof Symptoms, "painControlled" | "painScore">;

const SYMPTOM_KEYS: BooleanSymptomKey[] = [
  "breathless",
  "chestPain",
  "calfPainOrSwelling",
  "woundDischarge",
  "feverSubjective",
  "suddenSevereHipPain",
  "legShortenedOrRotated",
  "unableToWeightBear",
  "newConfusion",
];

const ECG_OPTIONS: EcgFlag[][] = [
  ["normal"],
  ["sinus_tachycardia"],
  ["new_af"],
  ["right_heart_strain"],
];

export function generateVignettes(n: number, seed = 20260726): Vignette[] {
  const r = rng(seed);
  const out: Vignette[] = [];

  for (let i = 0; i < n; i++) {
    const dayPostOp = Math.floor(r() * 60);

    const symptoms: Symptoms = {};
    const howMany = r() < 0.4 ? 0 : r() < 0.8 ? 1 : r() < 0.95 ? 2 : 3;
    for (const k of sample(r, SYMPTOM_KEYS, howMany)) symptoms[k] = true;
    if (r() < 0.5) symptoms.painControlled = r() < 0.75;

    // Vitals are sampled across and beyond physiologic range on purpose: the
    // quality gate is part of what we are testing, so it must see garbage.
    const quality: VitalsReading["quality"] =
      r() < 0.86 ? "ok" : r() < 0.93 ? "poor" : "stale";

    const vitals: VitalsReading = {
      timestamp: `synthetic-${i}`,
      quality,
      hr: r() < 0.95 ? Math.round(45 + r() * 105) : Math.round(r() * 400),
      sbp: r() < 0.95 ? Math.round(80 + r() * 90) : Math.round(r() * 400),
      dbp: Math.round(50 + r() * 50),
      tempC:
        r() < 0.95
          ? Math.round((36.0 + r() * 3.2) * 10) / 10
          : Math.round(r() * 60),
      ecgFlags: pick(r, ECG_OPTIONS),
    };

    out.push({ id: `vig-${String(i).padStart(5, "0")}`, dayPostOp, symptoms, vitals });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

export interface FieldScore {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function scoreExtraction(
  gold: Symptoms,
  pred: Symptoms,
): Record<string, FieldScore> {
  const keys = [...SYMPTOM_KEYS, "painControlled" as const];
  const out: Record<string, FieldScore> = {};

  for (const k of keys) {
    const g = gold[k];
    const p = pred[k];
    // painControlled is three-valued (true / false / not asked); the clinically
    // dangerous miss is failing to notice pain is NOT controlled, so that is
    // what we score as the positive class.
    const gPos = k === "painControlled" ? g === false : g === true;
    const pPos = k === "painControlled" ? p === false : p === true;

    out[k] = {
      tp: gPos && pPos ? 1 : 0,
      fp: !gPos && pPos ? 1 : 0,
      fn: gPos && !pPos ? 1 : 0,
      tn: !gPos && !pPos ? 1 : 0,
    };
  }
  return out;
}

export function prf(s: FieldScore) {
  const precision = s.tp + s.fp === 0 ? 1 : s.tp / (s.tp + s.fp);
  const recall = s.tp + s.fn === 0 ? 1 : s.tp / (s.tp + s.fn);
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}
