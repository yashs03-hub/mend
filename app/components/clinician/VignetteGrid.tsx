import { Check, ChevronRight, X } from "lucide-react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { auditRule } from "@/lib/clinical/rule-catalog";
import type { Severity, Symptoms, VitalsReading } from "@/lib/clinical/types";
import type { VignetteResult } from "@/lib/clinical/vignettes";
import { cn } from "@/lib/utils";

/**
 * The vignette suite, rendered from `public/vignettes.json`.
 *
 * A failing case renders as a failure. There is no filter, no "known issues"
 * bucket and no way for this component to show a green tick for a case whose
 * `pass` field is false — the headline count is computed from the same array
 * the cells are drawn from, so the number and the grid cannot disagree.
 *
 * A failure is drawn in the red severity token, and it never carries that
 * colour alone: the cell also gets a cross glyph and the word "fail", and the
 * mismatch is spelled out in words at the top of its body. That rule holds
 * here for the same reason it holds on a worklist — a projector that washes
 * the red out must still leave a judge able to count the failures.
 *
 * The severity chips inside a cell are something different again: they are
 * the engine's clinical verdict for that case, expected against actual, and
 * they come from the severity tokens because that is exactly what they mean.
 */

function vitalsLine(vitals: VitalsReading): string {
  const parts: string[] = [];
  if (vitals.hr !== undefined) parts.push(`HR ${vitals.hr}`);
  if (vitals.sbp !== undefined) parts.push(`SBP ${vitals.sbp}`);
  if (vitals.tempC !== undefined) parts.push(`${vitals.tempC.toFixed(1)} °C`);
  if (vitals.spo2 !== undefined) parts.push(`SpO₂ ${vitals.spo2}%`);
  if (parts.length === 0) parts.push("no values");
  if (vitals.quality !== "ok") parts.push(`quality ${vitals.quality}`);
  return parts.join(" · ");
}

function symptomsLine(symptoms: Symptoms): string {
  const parts = Object.entries(symptoms).map(([key, value]) =>
    typeof value === "number" ? `${key} ${value}` : value ? key : `${key}: false`,
  );
  return parts.length > 0 ? parts.join(" · ") : "none reported";
}

function Verdict({
  label,
  level,
  condition,
  rules,
}: {
  label: string;
  level: Severity;
  condition: string | undefined;
  rules: string[] | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <p className="eyebrow">{label}</p>
      <SeverityChip level={level} size="sm" />
      <p className="text-meta text-ink-secondary">{condition ?? "no condition named"}</p>
      {rules ? (
        <p className="numeric text-meta text-ink-tertiary">
          {rules.length > 0 ? rules.join(", ") : "no rule fired"}
        </p>
      ) : (
        <p className="text-meta text-ink-tertiary italic">rule ids not asserted</p>
      )}
    </div>
  );
}

function Cell({ result }: { result: VignetteResult }) {
  const Icon = result.pass ? Check : X;
  const audits = result.actual.firedRules.map((id) =>
    auditRule(id, {
      dayPostOp: result.day,
      symptoms: result.symptoms,
      vitals: result.vitals,
      ecg: result.ecg,
    }),
  );

  return (
    <details
      className={cn(
        "group min-w-0 rounded-xl border bg-raised shadow-card",
        result.pass ? "border-line" : "border-severity-red-border bg-severity-red-bg",
      )}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-start gap-3 p-4">
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
            result.pass
              ? "border-line-strong text-ink-secondary"
              : "border-severity-red-border text-severity-red-fg",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        </span>

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="numeric text-label font-medium text-ink">
              Vignette {result.name}
            </span>
            <span className="numeric text-meta text-ink-tertiary">day {result.day}</span>
            <span
              className={cn(
                "numeric text-meta font-medium uppercase tracking-[0.14em]",
                result.pass ? "text-ink-tertiary" : "text-severity-red-fg",
              )}
            >
              {result.pass ? "pass" : "fail"}
            </span>
          </span>
          <span className="block text-meta text-ink-secondary">{result.note}</span>
          <span className="numeric block text-meta text-ink-tertiary">
            {vitalsLine(result.vitals)}
          </span>
        </span>

        <ChevronRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-ink-tertiary transition-transform group-open:rotate-90"
        />
      </summary>

      <div className="space-y-4 border-t border-line px-4 py-4">
        {!result.pass ? (
          <div className="space-y-1 rounded-md border border-severity-red-border bg-raised p-3">
            <p className="eyebrow text-severity-red-fg">Mismatch</p>
            <ul className="space-y-0.5">
              {result.mismatches.map((mismatch) => (
                <li key={mismatch} className="numeric text-meta text-severity-red-fg">
                  {mismatch}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Verdict
            label="Expected"
            level={result.expected.level}
            condition={result.expected.condition}
            rules={result.expected.firedRules}
          />
          <Verdict
            label="Actual"
            level={result.actual.level}
            condition={result.actual.condition}
            rules={result.actual.firedRules}
          />
        </div>

        <div className="space-y-1">
          <p className="eyebrow">Input</p>
          <p className="numeric text-meta text-ink-secondary">
            day {result.day} · {vitalsLine(result.vitals)}
            {result.ecg ? ` · ECG ${result.ecg.determination}` : ""}
          </p>
          <p className="numeric text-meta text-ink-secondary">
            {symptomsLine(result.symptoms)}
          </p>
        </div>

        <div className="space-y-1">
          <p className="eyebrow">Rationale returned</p>
          {result.actual.rationale.map((line) => (
            <p key={line} className="font-serif text-body leading-snug text-ink">
              {line}
            </p>
          ))}
        </div>

        {audits.flatMap((audit) => audit.thresholds).length > 0 ? (
          <div className="space-y-1">
            <p className="eyebrow">Thresholds read</p>
            {audits.flatMap((audit) =>
              audit.thresholds.map((threshold) => (
                <p
                  key={`${audit.id}-${threshold.label}`}
                  className="text-meta text-ink-tertiary"
                >
                  <span className="numeric font-medium text-ink-secondary">
                    {threshold.value}
                  </span>{" "}
                  — {threshold.label}, {threshold.derivation}
                </p>
              )),
            )}
          </div>
        ) : null}

        <p className="font-serif text-body leading-snug text-ink-secondary">
          {result.actual.action}
        </p>
      </div>
    </details>
  );
}

export function VignetteGrid({ results }: { results: VignetteResult[] }) {
  const groups = [...new Set(results.map((r) => r.group))];

  return (
    <div className="space-y-10">
      {groups.map((group) => {
        const inGroup = results.filter((r) => r.group === group);
        const failed = inGroup.filter((r) => !r.pass).length;

        return (
          <section key={group} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-2">
              <h2 className="font-heading text-subhead text-ink">{group}</h2>
              <p className="numeric text-meta text-ink-tertiary">
                {inGroup.length - failed} of {inGroup.length} pass
                {failed > 0 ? ` · ${failed} failing` : ""}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {inGroup.map((result) => (
                <Cell key={result.name} result={result} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
