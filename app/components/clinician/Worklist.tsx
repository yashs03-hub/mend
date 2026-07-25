import Link from "next/link";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { Severity } from "@/lib/clinical/types";
import type { RosterPatient } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { TABLE_CELL as CELL, TABLE_HEAD as HEAD } from "./ClinicianShell";
import { clockTime, timeAgo } from "./format";

/**
 * The worklist.
 *
 * Read top-down, it should answer "who do I ring first?" in one pass, so the
 * sort is severity then recency and the severity column is the only saturated
 * thing on the page. Everything else is grayscale, which is exactly what
 * makes a red row jump.
 *
 * The severity cell carries a chip from `lib/ui/severity.ts` — icon, label
 * and colour together — because a table is where colour-only signalling is
 * most tempting and most dangerous: a washed-out projector turns a red row
 * into a slightly pink one, and the condition underneath is what actually
 * survives that.
 *
 * Below md the table re-flows into stacked cards from the same markup, with
 * each cell labelled by its column, so the phone view is a legible list
 * rather than a horizontally-scrolled spreadsheet.
 */

function EscalationCount({ open, closed }: { open: number; closed: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <span
        className={cn(
          "numeric text-body tabular-nums",
          open > 0 ? "font-medium text-ink" : "text-ink-tertiary",
        )}
      >
        {open}
      </span>
      <span className="numeric text-meta text-ink-tertiary">
        {closed > 0 ? `${closed} reviewed` : "none reviewed"}
      </span>
    </span>
  );
}

export function Worklist({
  patients,
  now,
  selectedId,
  onSelect,
}: {
  patients: RosterPatient[];
  now: Date;
  /** When set with `onSelect`, rows focus the hub chart instead of navigating. */
  selectedId?: string;
  onSelect?: (patientId: string) => void;
}) {
  const selectable = typeof onSelect === "function";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
      <table className="block w-full border-collapse md:table">
        <caption className="sr-only">
          Patients under remote monitoring, worst first, then most recently heard
          from.
        </caption>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-line bg-wash">
            <th scope="col" className={HEAD}>
              Patient
            </th>
            <th scope="col" className={HEAD}>
              Procedure
            </th>
            <th scope="col" className={cn(HEAD, "md:text-right")}>
              Post-op day
            </th>
            <th scope="col" className={HEAD}>
              Current severity
            </th>
            <th scope="col" className={HEAD}>
              Last check-in
            </th>
            <th scope="col" className={HEAD}>
              Open escalations
            </th>
            <th scope="col" className={cn(HEAD, "md:text-right")}>
              RPM days
            </th>
          </tr>
        </thead>

        <tbody className="block md:table-row-group">
          {patients.map((patient) => {
            const { decision } = patient.latest;
            const level: Severity = decision.level;
            const selected = selectable && selectedId === patient.id;

            return (
              <tr
                key={patient.id}
                data-level={level}
                data-selected={selected ? "true" : undefined}
                className={cn(
                  "relative block border-b border-line last:border-b-0 md:table-row",
                  "px-2 py-3 md:px-0 md:py-0",
                  "focus-within:bg-wash hover:bg-wash",
                  selected && "bg-wash",
                )}
              >
                <td className={cn(CELL, "md:w-[18%]")} data-label="Patient">
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => onSelect(patient.id)}
                      aria-pressed={selected}
                      className="inline-flex min-h-11 w-full flex-col justify-center text-left after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="text-body font-medium text-ink">
                        {patient.name}
                      </span>
                      <span className="numeric text-meta text-ink-tertiary">
                        {patient.age} · {patient.caregiver}
                      </span>
                    </button>
                  ) : (
                    <Link
                      href={`/clinician/${patient.id}`}
                      className="inline-flex min-h-11 flex-col justify-center after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="text-body font-medium text-ink">
                        {patient.name}
                      </span>
                      <span className="numeric text-meta text-ink-tertiary">
                        {patient.age} · {patient.caregiver}
                      </span>
                    </Link>
                  )}
                </td>

                <td className={cn(CELL, "md:w-[19%]")} data-label="Procedure">
                  <span className="flex flex-col text-right md:text-left">
                    <span className="text-label text-ink-secondary">
                      {patient.procedure}
                    </span>
                    <span className="numeric text-meta text-ink-tertiary">
                      {patient.phase.name}
                    </span>
                  </span>
                </td>

                <td
                  className={cn(CELL, "md:w-[8%] md:text-right")}
                  data-label="Post-op day"
                >
                  <span className="numeric text-body text-ink">
                    {patient.dayPostOp}
                  </span>
                </td>

                <td className={cn(CELL, "md:w-[22%]")} data-label="Current severity">
                  <span className="flex flex-col items-end gap-1 md:items-start">
                    <SeverityChip level={level} size="sm" />
                    <span className="text-meta text-ink-secondary">
                      {decision.condition ?? "No active finding"}
                    </span>
                  </span>
                </td>

                <td className={cn(CELL, "md:w-[13%]")} data-label="Last check-in">
                  <span className="flex flex-col items-end md:items-start">
                    <span className="numeric text-label text-ink">
                      {timeAgo(patient.latest.at, now)}
                    </span>
                    <time
                      dateTime={patient.latest.at}
                      className="numeric text-meta text-ink-tertiary"
                    >
                      {clockTime(patient.latest.at)} · day {patient.latest.dayPostOp}
                    </time>
                  </span>
                </td>

                <td className={cn(CELL, "md:w-[12%]")} data-label="Open escalations">
                  <EscalationCount
                    open={patient.openEscalations}
                    closed={patient.closedEscalations}
                  />
                </td>

                <td
                  className={cn(CELL, "md:w-[8%] md:text-right")}
                  data-label="RPM days"
                >
                  <span className="flex flex-col items-end">
                    <span className="numeric text-label text-ink-secondary">
                      {patient.billing.monitoringDays}
                    </span>
                    <span className="numeric text-meta text-ink-tertiary">
                      {patient.billing.monitoringDays >= 16
                        ? "supply bar met"
                        : `${16 - patient.billing.monitoringDays} to 99454`}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
