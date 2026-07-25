import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import {
  ClinicianShell,
  Panel,
  SectionHeading,
  TABLE_CELL,
  TABLE_HEAD,
} from "@/app/components/clinician/ClinicianShell";
import { fullDate, timeAgo } from "@/app/components/clinician/format";
import { VignetteGrid } from "@/app/components/clinician/VignetteGrid";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { RULE_CATALOG, resolveThresholds } from "@/lib/clinical/rule-catalog";
import type { VignetteResult } from "@/lib/clinical/vignettes";

/**
 * /clinician/engine — the rule table, open for inspection.
 *
 * This page exists so that nobody has to take the deterministic core on
 * trust. It renders `public/vignettes.json` exactly as `npm test`'s
 * `posttest` hook wrote it: every vignette run through the real `evaluate()`,
 * with what was expected, what came back, and whether they matched.
 *
 * It reads the file at request time rather than importing it at build time,
 * so the page can say honestly when the results were generated — and so a
 * missing file degrades to an instruction to run the suite instead of
 * breaking the build with a stale artefact baked in.
 *
 * Nothing here filters. If a case fails, the headline count drops, the cell
 * turns red and the mismatch is printed.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rule engine — Mend",
  description:
    "The red-flag vignette suite, executed against the deterministic engine and rendered pass by pass, with the rule table it is testing.",
};

const VIGNETTES_PATH = path.join(process.cwd(), "public", "vignettes.json");

/** Day 4 — the phase the demo lives in — used to work the rule table's example. */
const WORKED_EXAMPLE_PHASE = getPhase(4);

interface Loaded {
  results: VignetteResult[];
  generatedAt: string | undefined;
  error: string | undefined;
}

async function loadVignettes(): Promise<Loaded> {
  try {
    const [raw, stats] = await Promise.all([
      readFile(VIGNETTES_PATH, "utf8"),
      stat(VIGNETTES_PATH),
    ]);
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return { results: [], generatedAt: undefined, error: "vignettes.json is not an array" };
    }

    return {
      results: parsed as VignetteResult[],
      generatedAt: stats.mtime.toISOString(),
      error: undefined,
    };
  } catch {
    return {
      results: [],
      generatedAt: undefined,
      error:
        "public/vignettes.json has not been generated yet. Run npm test — its posttest hook writes it.",
    };
  }
}

function Headline({
  passed,
  total,
  generatedAt,
  now,
}: {
  passed: number;
  total: number;
  generatedAt: string | undefined;
  now: Date;
}) {
  const failed = total - passed;

  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-card sm:grid-cols-3">
      <div className="space-y-2 bg-raised px-6 py-6">
        <p className="eyebrow">Vignettes passing</p>
        <p className="flex items-baseline gap-2">
          <span className="numeric text-title leading-none font-medium text-ink">
            {passed}
          </span>
          <span className="numeric text-lg text-ink-tertiary">/ {total}</span>
        </p>
        <p className="text-meta text-ink-secondary">
          {failed === 0
            ? "Every case in the suite matches the engine's current behaviour."
            : failed === 1
              ? "1 case disagrees with the engine and is shown in red below."
              : `${failed} cases disagree with the engine and are shown in red below.`}
        </p>
      </div>

      <div className="space-y-2 bg-raised px-6 py-6">
        <p className="eyebrow">Rules under test</p>
        <p className="numeric text-title leading-none font-medium text-ink">
          {RULE_CATALOG.filter((r) => r.origin === "red-flag-engine").length}
        </p>
        <p className="text-meta text-ink-secondary">
          Red-flag rules in precedence order, plus{" "}
          {RULE_CATALOG.filter((r) => r.origin === "trend-engine").length} trend
          findings that can raise green to amber.
        </p>
      </div>

      <div className="space-y-2 bg-raised px-6 py-6">
        <p className="eyebrow">Generated</p>
        <p className="numeric text-lg font-medium text-ink">
          {generatedAt ? timeAgo(generatedAt, now) : "never"}
        </p>
        <p className="text-meta text-ink-secondary">
          {generatedAt ? fullDate(generatedAt) : "run npm test"} · written by{" "}
          <span className="numeric">scripts/export-vignettes.ts</span> on every{" "}
          <span className="numeric">npm test</span>.
        </p>
      </div>
    </div>
  );
}

export default async function EnginePage() {
  const now = new Date();
  const { results, generatedAt, error } = await loadVignettes();
  const passed = results.filter((r) => r.pass).length;

  return (
    <ClinicianShell active="/clinician/engine">
      <div className="max-w-4xl space-y-3 pt-8 pb-6">
        <h1 className="font-heading text-heading text-ink">Rule engine</h1>
        <p className="text-label text-ink-secondary">
          Mend puts language models at the edges and a deterministic core in the
          middle. This page is the core, open for inspection: every vignette
          below was executed against the same{" "}
          <span className="numeric">evaluate()</span> that runs on a live call,
          and the results are written to{" "}
          <span className="numeric">public/vignettes.json</span> by the test
          suite rather than typed in. Nothing on this page is filtered — a case
          that disagrees with the engine renders red and stays visible.
        </p>
      </div>

      {error ? (
        <Panel className="p-6">
          <p className="text-label text-ink-secondary">{error}</p>
        </Panel>
      ) : (
        <>
          <Headline
            passed={passed}
            total={results.length}
            generatedAt={generatedAt}
            now={now}
          />

          <div className="pt-10">
            <VignetteGrid results={results} />
          </div>

          <div className="space-y-4 pt-12">
            <SectionHeading
              title="Rule table"
              meta={`${RULE_CATALOG.length} rules · red before amber, first match wins`}
            />
            <p className="max-w-4xl text-label text-ink-secondary">
              Every rule the product can fire, with the inputs it reads and the
              thresholds it compares them against. Where a threshold is derived
              from the recovery phase, the derivation is shown; where it is a
              hard-coded constant, it says so.
            </p>
            <Panel className="overflow-hidden">
              <table className="block w-full border-collapse md:table">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-line bg-wash">
                    <th scope="col" className={TABLE_HEAD}>
                      Rule id
                    </th>
                    <th scope="col" className={TABLE_HEAD}>
                      Level
                    </th>
                    <th scope="col" className={TABLE_HEAD}>
                      Condition
                    </th>
                    <th scope="col" className={TABLE_HEAD}>
                      What it tests
                    </th>
                    <th scope="col" className={TABLE_HEAD}>
                      Thresholds, worked for day 4
                    </th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group">
                  {RULE_CATALOG.map((rule) => (
                    <tr
                      key={rule.id}
                      className="block border-b border-line px-2 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
                    >
                      <td
                        data-label="Rule id"
                        className={`${TABLE_CELL} numeric font-medium break-all text-ink md:align-top md:whitespace-nowrap`}
                      >
                        {rule.id}
                      </td>
                      <td
                        data-label="Level"
                        className={`${TABLE_CELL} text-meta text-ink-secondary md:align-top md:whitespace-nowrap`}
                      >
                        {rule.severity}
                      </td>
                      <td
                        data-label="Condition"
                        className={`${TABLE_CELL} text-meta text-ink-secondary md:align-top`}
                      >
                        {rule.condition}
                      </td>
                      <td
                        data-label="What it tests"
                        className={`${TABLE_CELL} text-meta text-ink-secondary md:align-top`}
                      >
                        <span className="text-right md:text-left">{rule.test}</span>
                      </td>
                      <td
                        data-label="Thresholds"
                        className={`${TABLE_CELL} numeric text-meta text-ink-tertiary md:align-top`}
                      >
                        <span className="text-right md:text-left">
                          {rule.thresholds.length === 0
                            ? "symptom or determination only"
                            : resolveThresholds(rule, WORKED_EXAMPLE_PHASE)
                                .map((t) => `${t.label} ${t.value}`)
                                .join(" · ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <p className="max-w-4xl text-meta text-ink-tertiary">
              Threshold values in this table are worked against the Early
              protected phase (day 0–13) as an example. Each patient&apos;s audit
              trail resolves them against the phase that check-in actually fell
              in, which is why the same 37.8 °C is green on day 2 and amber on
              day 21.
            </p>
          </div>
        </>
      )}
    </ClinicianShell>
  );
}
