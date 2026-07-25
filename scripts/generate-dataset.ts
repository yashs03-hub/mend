/**
 * Emits both synthetic corpora as JSONL.
 *
 *   npx tsx scripts/generate-dataset.ts [--extraction N] [--vignettes N] [--seed N]
 *
 * SYNTHETIC DATA ONLY. Nothing here derives from a real patient, and nothing
 * real should ever be added to it.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  generateExtractionCorpus,
  generateVignettes,
} from "../lib/data/generate";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

const nExtraction = arg("extraction", 1200);
const nVignettes = arg("vignettes", 2000);
const seed = arg("seed", 20260725);

const outDir = join(process.cwd(), "data");
mkdirSync(outDir, { recursive: true });

const extraction = generateExtractionCorpus(nExtraction, seed);
const vignettes = generateVignettes(nVignettes, seed + 1);

const toJsonl = (rows: unknown[]) =>
  rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

writeFileSync(join(outDir, "extraction-corpus.jsonl"), toJsonl(extraction));
writeFileSync(join(outDir, "vignettes.jsonl"), toJsonl(vignettes));

// A tiny manifest so a reader can tell what they are looking at without
// reverse-engineering it from the rows.
const positives = extraction.filter((e) => Object.keys(e.gold).length > 0).length;
const withNegation = extraction.filter((e) =>
  e.composition.includes("negated"),
).length;

writeFileSync(
  join(outDir, "MANIFEST.json"),
  JSON.stringify(
    {
      generatedBy: "scripts/generate-dataset.ts",
      seed,
      synthetic: true,
      warning:
        "Synthetic data only. No real patient data. Do not use to make clinical claims.",
      extractionCorpus: {
        file: "extraction-corpus.jsonl",
        rows: extraction.length,
        withAtLeastOneSymptom: positives,
        containingAnExplicitDenial: withNegation,
        labelSource:
          "generator intent — ground truth by construction, independent of the extractor",
      },
      vignettes: {
        file: "vignettes.jsonl",
        rows: vignettes.length,
        labelSource:
          "UNLABELLED. Labels are produced at evaluation time by lib/data/rubric.ts, " +
          "which is an independently written second opinion — not external validation.",
      },
    },
    null,
    2,
  ) + "\n",
);

console.log(`extraction-corpus.jsonl  ${extraction.length} rows`);
console.log(`  with >=1 symptom       ${positives}`);
console.log(`  containing a denial    ${withNegation}`);
console.log(`vignettes.jsonl          ${vignettes.length} rows`);
console.log(`seed                     ${seed}`);
