/**
 * Runs the red-flag vignette suite and writes the result to
 * `public/vignettes.json`, which `/clinician/engine` renders verbatim.
 *
 *   npm test        runs this afterwards via the `posttest` script
 *   npx tsx scripts/export-vignettes.ts
 *
 * This is a reporter, not a gate. It always exits 0 and always writes what
 * `evaluate()` actually returned, including failures: the engine page is
 * supposed to show a red cell to a judge who asks to inspect the rule table,
 * not to be prevented from being generated. The gate is
 * `lib/clinical/red-flag-engine.test.ts`, which is where a regression stops
 * the build.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runVignettes } from "../lib/clinical/vignettes";

const OUT = path.resolve("public", "vignettes.json");

async function main() {
  const results = runVignettes();
  const failed = results.filter((r) => !r.pass);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  console.log(
    `vignettes: ${results.length - failed.length}/${results.length} pass ` +
      `-> ${path.relative(process.cwd(), OUT)}`,
  );

  for (const result of failed) {
    console.log(`  FAIL ${result.name}: ${result.mismatches.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
