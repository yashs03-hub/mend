import type { ReactNode } from "react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { billableUnits, evaluateBilling } from "@/lib/clinical/billing";
import type { Severity } from "@/lib/clinical/types";
import type { RosterPatient } from "@/lib/sim/roster";

/**
 * The one-line answer to "how is the panel doing, and is it paying for
 * itself?", above the worklist.
 *
 * Every figure is counted from the roster and the billing module at render
 * time. The two severity counts are chips rather than numbers in a coloured
 * box, so the summary obeys the same never-colour-alone rule as the rows it
 * summarises.
 */

function Stat({
  label,
  children,
  detail,
}: {
  label: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4 first:pl-0">
      <p className="eyebrow">{label}</p>
      <div className="flex min-h-8 flex-wrap items-center gap-2">{children}</div>
      {detail ? (
        <p className="numeric text-meta text-ink-tertiary">{detail}</p>
      ) : null}
    </div>
  );
}

function Figure({ value, unit }: { value: number | string; unit?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="numeric text-2xl leading-none font-medium text-ink">
        {value}
      </span>
      {unit ? <span className="text-meta text-ink-tertiary">{unit}</span> : null}
    </p>
  );
}

export function PracticeSummary({ patients }: { patients: RosterPatient[] }) {
  const count = (level: Severity) =>
    patients.filter((p) => p.latest.decision.level === level).length;

  const openEscalations = patients.reduce((sum, p) => sum + p.openEscalations, 0);
  const monitoringDays = patients.reduce(
    (sum, p) => sum + p.billing.monitoringDays,
    0,
  );
  const managementMinutes = patients.reduce(
    (sum, p) => sum + p.billing.managementMinutes,
    0,
  );
  const units = patients.reduce(
    (sum, p) => sum + billableUnits(evaluateBilling(p.billing)),
    0,
  );
  const supplyReady = patients.filter((p) => p.billing.monitoringDays >= 16).length;

  return (
    <div className="grid grid-cols-2 divide-line border-y border-line sm:grid-cols-3 sm:divide-x xl:grid-cols-6">
      <Stat label="On the panel" detail="all synthetic, no PHI">
        <Figure value={patients.length} unit="patients" />
      </Stat>

      <Stat label="Needing a clinician" detail={`${count("green")} on track`}>
        {count("red") > 0 ? (
          <SeverityChip level="red" size="sm" label={`${count("red")} urgent`} />
        ) : null}
        {count("amber") > 0 ? (
          <SeverityChip
            level="amber"
            size="sm"
            label={`${count("amber")} needs attention`}
          />
        ) : null}
        {count("red") + count("amber") === 0 ? (
          <SeverityChip level="green" size="sm" label="all on track" />
        ) : null}
      </Stat>

      <Stat label="Open escalations" detail="unacknowledged, all patients">
        <Figure value={openEscalations} unit="to review" />
      </Stat>

      <Stat
        label="Monitoring days"
        detail={`${supplyReady} of ${patients.length} past the 16-day supply bar`}
      >
        <Figure value={monitoringDays} unit="this period" />
      </Stat>

      <Stat label="Management time" detail="logged against RPM/RTM review">
        <Figure value={managementMinutes} unit="minutes" />
      </Stat>

      <Stat label="Claimable units" detail="RPM and RTM, accrued not submitted">
        <Figure value={units} unit="codes" />
      </Stat>
    </div>
  );
}
