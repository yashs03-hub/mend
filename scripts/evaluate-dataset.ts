/**
 * Runs both corpora and reports what the numbers do — and do not — mean.
 *
 *   npx tsx scripts/evaluate-dataset.ts
 *
 * Part 1 measures the keyword extractor against ground truth. That number is
 * real: the labels were fixed before the extractor ever saw the text.
 *
 * Part 2 compares the engine against an independently written rubric. That
 * number is NOT accuracy. Agreement means two implementations of the same
 * intent concur; it says nothing about whether the intent is clinically right.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractSymptomsHeuristic } from "../lib/llm/extract";
import { evaluate } from "../lib/clinical/red-flag-engine";
import { rubricSeverity } from "../lib/data/rubric";
import {
  scoreExtraction,
  prf,
  FieldScore,
  ExtractionExample,
  Vignette,
} from "../lib/data/generate";
import { Severity } from "../lib/clinical/types";

function readJsonl<T>(name: string): T[] {
  const path = join(process.cwd(), "data", name);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

const pct = (n: number) => (n * 100).toFixed(1).padStart(5) + "%";

// ---------------------------------------------------------------------------
console.log("\n=== 1. EXTRACTION — keyword fallback vs ground truth ===");
console.log("Labels are ground truth by construction. These numbers are real.\n");

const corpus = readJsonl<ExtractionExample>("extraction-corpus.jsonl");
const totals: Record<string, FieldScore> = {};

for (const ex of corpus) {
  const pred = extractSymptomsHeuristic(ex.transcript);
  const scored = scoreExtraction(ex.gold, pred);
  for (const [k, s] of Object.entries(scored)) {
    totals[k] ??= { tp: 0, fp: 0, fn: 0, tn: 0 };
    totals[k].tp += s.tp;
    totals[k].fp += s.fp;
    totals[k].fn += s.fn;
    totals[k].tn += s.tn;
  }
}

console.log(
  "field".padEnd(24) + "prec".padStart(7) + "recall".padStart(8) + "F1".padStart(7) + "   FP    FN",
);
console.log("-".repeat(60));
const rows = Object.entries(totals).sort(
  (a, b) => prf(a[1]).f1 - prf(b[1]).f1,
);
for (const [k, s] of rows) {
  const m = prf(s);
  console.log(
    k.padEnd(24) +
      pct(m.precision) +
      pct(m.recall).padStart(8) +
      pct(m.f1).padStart(7) +
      String(s.fp).padStart(5) +
      String(s.fn).padStart(6),
  );
}

// The clinically dangerous error is a false positive on a denial: telling a
// well patient to worry, which is how you lose a clinician's trust.
const denialRows = corpus.filter((e) => e.composition.includes("negated"));
let denialFP = 0;
for (const ex of denialRows) {
  const pred = extractSymptomsHeuristic(ex.transcript);
  const scored = scoreExtraction(ex.gold, pred);
  denialFP += Object.values(scored).reduce((a, s) => a + s.fp, 0);
}
console.log(
  `\nTranscripts containing an explicit denial: ${denialRows.length}` +
    `\n  false positives raised on them:         ${denialFP}`,
);

// ---------------------------------------------------------------------------
console.log("\n\n=== 2. ENGINE vs INDEPENDENT RUBRIC — differential test ===");
console.log("NOT accuracy. Disagreement = one of the two is wrong.\n");

const vignettes = readJsonl<Vignette>("vignettes.jsonl");
const levels: Severity[] = ["green", "amber", "red"];
const matrix: Record<string, Record<string, number>> = {};
for (const a of levels) {
  matrix[a] = {};
  for (const b of levels) matrix[a][b] = 0;
}

const disagreements: {
  id: string;
  engine: Severity;
  rubric: Severity;
  why: string;
}[] = [];

for (const v of vignettes) {
  const e = evaluate({
    dayPostOp: v.dayPostOp,
    symptoms: v.symptoms,
    vitals: v.vitals,
  });
  const r = rubricSeverity({
    dayPostOp: v.dayPostOp,
    symptoms: v.symptoms,
    vitals: v.vitals,
  });
  matrix[r.severity][e.level]++;
  if (r.severity !== e.level) {
    disagreements.push({
      id: v.id,
      engine: e.level,
      rubric: r.severity,
      why: `engine: ${e.rationale[0]} | rubric: ${r.because[0]}`,
    });
  }
}

console.log("rubric \\ engine".padEnd(18) + levels.map((l) => l.padStart(8)).join(""));
for (const r of levels) {
  console.log(
    r.padEnd(18) + levels.map((e) => String(matrix[r][e]).padStart(8)).join(""),
  );
}

const agree = levels.reduce((a, l) => a + matrix[l][l], 0);
console.log(
  `\nAgreement: ${agree}/${vignettes.length} (${((agree / vignettes.length) * 100).toFixed(2)}%)`,
);

// A disagreement where the rubric is more worried than the engine is the one
// that matters: it is a candidate missed escalation.
const engineLessWorried = disagreements.filter(
  (d) => levels.indexOf(d.rubric) > levels.indexOf(d.engine),
);
console.log(`Disagreements:             ${disagreements.length}`);
console.log(`  engine LESS worried:     ${engineLessWorried.length}  <- adjudicate these first`);
console.log(`  engine MORE worried:     ${disagreements.length - engineLessWorried.length}`);

if (disagreements.length) {
  console.log("\nFirst 10 for adjudication:");
  for (const d of disagreements.slice(0, 10)) {
    console.log(`  ${d.id}  rubric=${d.rubric} engine=${d.engine}`);
    console.log(`     ${d.why}`);
  }
}

console.log(
  "\nReminder: both the engine and the rubric were written by the same author " +
    "from the same understanding.\nAgreement is internal consistency, not clinical " +
    "validity. See docs/CLINICAL_SOURCES.md.\n",
);
