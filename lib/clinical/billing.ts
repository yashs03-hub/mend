/**
 * Remote-monitoring billing capture.
 *
 * Mend's revenue argument is not a slide: a post-op recovery programme that
 * takes a daily physiologic reading and logs clinical review time is already
 * doing the work Medicare reimburses under RPM (99453/99454/99457/99458) and
 * RTM (98975/98977/98980/98981). This module turns the check-in history the
 * product already has into the accrual state those codes are judged on, so
 * the clinician view can show a practice exactly what it has earned and what
 * it is short of.
 *
 * Three deliberate constraints:
 *
 *  - Nothing here is a claim. It reports accrual against a stated requirement
 *    and names the gap when the requirement is unmet. A practice's biller
 *    still decides what to submit.
 *  - The 16-days-in-30 device-supply requirement and the 20-minute management
 *    increments are the load-bearing numbers, so they are named on screen
 *    next to the count rather than folded into a "ready to bill" boolean.
 *  - RPM and RTM management time cannot both be claimed for the same patient
 *    in the same period. Rather than silently pick one, `evaluateBilling`
 *    marks the suppressed pair `blocked` and says which line is claiming.
 */

export type BillingProgram = "RPM" | "RTM";
export type BillingStatus = "met" | "pending" | "blocked";

export interface BillingPeriod {
  /** ISO date the current 30-day monitoring period opened. */
  periodStart: string;
  /** ISO date it closes. */
  periodEnd: string;
  /** Distinct calendar days in the period carrying a transmitted reading. */
  monitoringDays: number;
  /** Clinical staff time logged reviewing and managing this patient, in minutes. */
  managementMinutes: number;
  /** Device set-up and patient education completed and documented. */
  setupComplete: boolean;
  /** At least one live interactive communication with the patient in the period. */
  interactiveContact: boolean;
}

export interface BillingLine {
  code: string;
  program: BillingProgram;
  /** What the code pays for, in the payer's terms. */
  description: string;
  /** The condition that has to be true, stated as a number wherever it is one. */
  requirement: string;
  status: BillingStatus;
  /** Billable units accrued. 0 whenever status is not "met". */
  units: number;
  /** Accrual against the requirement, for a progress readout. */
  progress?: { value: number; target: number; unit: string };
  /** What is still missing, why the line is blocked, or where the next unit lands. */
  gap?: string;
}

/** Days of transmitted data required in a 30-day period for device supply. */
export const DEVICE_SUPPLY_DAYS_REQUIRED = 16;
/** Minutes in the first management increment, and in each additional one. */
export const MANAGEMENT_INCREMENT_MINUTES = 20;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function setupLine(
  code: string,
  program: BillingProgram,
  period: BillingPeriod,
): BillingLine {
  return {
    code,
    program,
    description: "Initial set-up and patient education on use of the device",
    requirement: "Once per episode of care, documented",
    status: period.setupComplete ? "met" : "pending",
    units: period.setupComplete ? 1 : 0,
    gap: period.setupComplete ? undefined : "Set-up and education not yet documented",
  };
}

function deviceSupplyLine(
  code: string,
  program: BillingProgram,
  period: BillingPeriod,
): BillingLine {
  const met = period.monitoringDays >= DEVICE_SUPPLY_DAYS_REQUIRED;
  const short = DEVICE_SUPPLY_DAYS_REQUIRED - period.monitoringDays;

  return {
    code,
    program,
    description:
      program === "RPM"
        ? "Device supply with daily recordings or programmed alerts, per 30 days"
        : "Device supply for musculoskeletal therapeutic monitoring, per 30 days",
    requirement: `${DEVICE_SUPPLY_DAYS_REQUIRED} days of transmitted data in 30`,
    status: met ? "met" : "pending",
    units: met ? 1 : 0,
    progress: {
      value: period.monitoringDays,
      target: DEVICE_SUPPLY_DAYS_REQUIRED,
      unit: "days",
    },
    gap: met ? undefined : `${plural(short, "more monitoring day")} needed this period`,
  };
}

function firstManagementLine(
  code: string,
  program: BillingProgram,
  period: BillingPeriod,
  blockedBy?: string,
): BillingLine {
  const enoughTime = period.managementMinutes >= MANAGEMENT_INCREMENT_MINUTES;
  const met = enoughTime && period.interactiveContact;
  const short = MANAGEMENT_INCREMENT_MINUTES - period.managementMinutes;

  const gap = !period.interactiveContact
    ? "No interactive communication logged this period"
    : `${plural(short, "more minute")} of management time needed`;

  return {
    code,
    program,
    description: `Treatment management, first ${MANAGEMENT_INCREMENT_MINUTES} minutes per period`,
    requirement: `${MANAGEMENT_INCREMENT_MINUTES} minutes plus one interactive communication`,
    status: blockedBy ? "blocked" : met ? "met" : "pending",
    units: blockedBy || !met ? 0 : 1,
    progress: {
      value: Math.min(period.managementMinutes, MANAGEMENT_INCREMENT_MINUTES),
      target: MANAGEMENT_INCREMENT_MINUTES,
      unit: "minutes",
    },
    gap: blockedBy ?? (met ? undefined : gap),
  };
}

function additionalManagementLine(
  code: string,
  program: BillingProgram,
  period: BillingPeriod,
  blockedBy?: string,
): BillingLine {
  const eligible = period.interactiveContact
    ? Math.max(
        0,
        Math.floor(
          (period.managementMinutes - MANAGEMENT_INCREMENT_MINUTES) /
            MANAGEMENT_INCREMENT_MINUTES,
        ),
      )
    : 0;
  const units = blockedBy ? 0 : eligible;
  const nextAt = MANAGEMENT_INCREMENT_MINUTES * (eligible + 2);

  return {
    code,
    program,
    description: `Treatment management, each additional ${MANAGEMENT_INCREMENT_MINUTES} minutes`,
    requirement: `Each complete ${MANAGEMENT_INCREMENT_MINUTES} minutes beyond the first`,
    status: blockedBy ? "blocked" : units > 0 ? "met" : "pending",
    units,
    progress: {
      value: Math.min(period.managementMinutes, nextAt),
      target: nextAt,
      unit: "minutes",
    },
    gap: blockedBy ?? `Next unit at ${nextAt} minutes`,
  };
}

/**
 * The eight codes, in the order a biller reads them: set-up, device supply,
 * first management increment, additional increments — RPM then RTM.
 *
 * Concurrency: when the RPM management line is claimable, the equivalent RTM
 * lines are returned `blocked` naming 99457, because the same minutes cannot
 * be counted twice. The RTM device-supply and set-up lines are still reported
 * on their own merits, since a practice running the therapy-monitoring
 * pathway bills those instead.
 */
export function evaluateBilling(period: BillingPeriod): BillingLine[] {
  const rpmFirst = firstManagementLine("99457", "RPM", period);
  const rpmClaiming = rpmFirst.status === "met";
  const blockedBy = rpmClaiming
    ? "Suppressed: 99457 is claiming this period's management time"
    : undefined;

  return [
    setupLine("99453", "RPM", period),
    deviceSupplyLine("99454", "RPM", period),
    rpmFirst,
    additionalManagementLine("99458", "RPM", period, undefined),
    setupLine("98975", "RTM", period),
    deviceSupplyLine("98977", "RTM", period),
    firstManagementLine("98980", "RTM", period, blockedBy),
    additionalManagementLine("98981", "RTM", period, blockedBy),
  ];
}

/** Headline for the panel: how many units are claimable right now. */
export function billableUnits(lines: readonly BillingLine[]): number {
  return lines.reduce((sum, line) => sum + line.units, 0);
}
