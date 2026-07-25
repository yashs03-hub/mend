import { Ban, Check, Clock } from "lucide-react";
import {
  billableUnits,
  evaluateBilling,
  type BillingLine,
  type BillingPeriod,
  type BillingProgram,
} from "@/lib/clinical/billing";
import { cn } from "@/lib/utils";
import { shortDate } from "./format";

/**
 * Billing capture: the "who pays" argument, made visible.
 *
 * A daily voice check-in that records a physiologic reading and logs review
 * time is already doing the work RPM and RTM reimburse. This panel says so in
 * the payer's own vocabulary — the codes are named, the requirement each one
 * is judged on is printed next to the count, and a code that is short says
 * exactly how short.
 *
 * The status marks are deliberately not severity colours. Clinical severity
 * is the only saturated colour in Mend and it means one thing; a billing
 * threshold being unmet is not a clinical event and must not compete with a
 * red row for the same attention. So this whole panel is grayscale, with the
 * state carried by an icon and a word.
 */

const STATUS_ICON = {
  met: Check,
  pending: Clock,
  blocked: Ban,
} as const;

const STATUS_LABEL = {
  met: "Accrued",
  pending: "Short",
  blocked: "Suppressed",
} as const;

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = Math.max(0, Math.min(100, (value / target) * 100));
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-wash-strong"
      role="presentation"
    >
      <div className="h-full rounded-full bg-ink-tertiary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Line({ line }: { line: BillingLine }) {
  const Icon = STATUS_ICON[line.status];

  return (
    <li className="space-y-1.5 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-baseline gap-2">
          <span className="numeric text-label font-medium text-ink">{line.code}</span>
          <span className="numeric text-meta text-ink-tertiary">{line.program}</span>
        </p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-meta",
            line.status === "met" ? "font-medium text-ink" : "text-ink-tertiary",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            {STATUS_LABEL[line.status]}
            {line.units > 0 ? ` · ${line.units} unit${line.units === 1 ? "" : "s"}` : ""}
          </span>
        </p>
      </div>

      <p className="text-meta text-ink-secondary">{line.description}</p>

      {line.progress ? (
        <div className="space-y-1 pt-0.5">
          <ProgressBar value={line.progress.value} target={line.progress.target} />
          <p className="numeric text-meta text-ink-tertiary">
            {line.progress.value} of {line.progress.target} {line.progress.unit} ·{" "}
            {line.requirement}
          </p>
        </div>
      ) : (
        <p className="numeric text-meta text-ink-tertiary">{line.requirement}</p>
      )}

      {line.gap ? <p className="text-meta text-ink-tertiary italic">{line.gap}</p> : null}
    </li>
  );
}

function Group({
  program,
  lines,
  blurb,
}: {
  program: BillingProgram;
  lines: BillingLine[];
  blurb: string;
}) {
  return (
    <div>
      <div className="space-y-0.5 border-b border-line bg-wash px-4 py-2.5">
        <p className="eyebrow">{program}</p>
        <p className="text-meta text-ink-tertiary">{blurb}</p>
      </div>
      <ul>
        {lines.map((line) => (
          <Line key={line.code} line={line} />
        ))}
      </ul>
    </div>
  );
}

export function BillingPanel({ period }: { period: BillingPeriod }) {
  const lines = evaluateBilling(period);
  const units = billableUnits(lines);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-4">
        <div className="space-y-1">
          <p className="eyebrow">Accrued this period</p>
          <p className="flex items-baseline gap-2">
            <span className="numeric text-2xl leading-none font-medium text-ink">
              {units}
            </span>
            <span className="text-meta text-ink-tertiary">
              billable unit{units === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <dl className="space-y-0.5 text-right">
          <div className="flex items-baseline justify-end gap-2">
            <dt className="text-meta text-ink-tertiary">Monitoring days</dt>
            <dd className="numeric text-label font-medium text-ink">
              {period.monitoringDays}
            </dd>
          </div>
          <div className="flex items-baseline justify-end gap-2">
            <dt className="text-meta text-ink-tertiary">Management time</dt>
            <dd className="numeric text-label font-medium text-ink">
              {period.managementMinutes} min
            </dd>
          </div>
          <p className="numeric text-meta text-ink-tertiary">
            {shortDate(period.periodStart)} – {shortDate(period.periodEnd)}
          </p>
        </dl>
      </div>

      <div className="grid divide-line lg:grid-cols-2 lg:divide-x">
        <Group
          program="RPM"
          lines={lines.filter((l) => l.program === "RPM")}
          blurb="Remote physiologic monitoring — heart rate, oxygen, temperature"
        />
        <Group
          program="RTM"
          lines={lines.filter((l) => l.program === "RTM")}
          blurb="Remote therapeutic monitoring — musculoskeletal status and adherence"
        />
      </div>

      <p className="border-t border-line px-4 py-3 text-meta text-ink-tertiary">
        Accrual, not a claim. RPM and RTM management time cannot both be claimed
        for the same patient in the same period, so the RTM pair is suppressed
        while 99457 is claiming. A practice&apos;s biller still decides what is
        submitted.
      </p>
    </div>
  );
}
