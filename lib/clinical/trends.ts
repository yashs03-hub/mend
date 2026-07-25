import type { Phase, Symptoms, TrendFinding, VitalsReading } from "./types";

/**
 * Escalation on trajectory, not on any single threshold breach. `evaluate()`
 * (red-flag-engine.ts) decides the level for a single reading; this module
 * only ever produces findings — composing them into a Decision happens
 * elsewhere (Task 12), where trend findings may raise green to amber but may
 * never lower any level.
 *
 * Invalid-timestamp policy: a reading whose `timestamp` does not parse
 * (`Date.parse` returns `NaN`) is DROPPED before sorting or regression, not
 * coerced to a guessed time or passed through. Two reasons: (1) an
 * unparseable timestamp cannot be placed in the sort order, so leaving it in
 * would put the window in an arbitrary, engine-dependent order; and (2) NaN
 * silently poisons the OLS arithmetic downstream (comparisons against NaN
 * are always false, so a threshold check like `slope < 3` could pass through
 * a broken finding with `NaN` printed in the clinician-facing description
 * instead of safely producing no finding). Dropping the single bad reading —
 * rather than rejecting the whole call — matches how a metric that is merely
 * absent is already handled: fall back to "insufficient data" for the
 * affected window rather than fabricate or corrupt a trend.
 */

const MAX_WINDOW = 7;
const MIN_POINTS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fixed, defensible per-day rate thresholds. HR/SpO2/painScore values are
 * given verbatim by the brief. Temperature is not specified by the brief, so
 * we choose +0.15C/day: sustained at that rate it adds up to roughly 1C of
 * drift across the 7-day window cap, well before any single reading would
 * cross the phase's absolute tempCMax (the red-flag-engine's own fever
 * rule) — which is exactly the gap a trajectory-only escalation is meant to
 * close. A single day-to-day thermometer wobble of a few tenths of a degree
 * will not sustain that slope across >=3 points, so this does not fire on
 * ordinary noise (see trends.test.ts "trivial temperature wobble").
 */
const TEMP_SLOPE_THRESHOLD_C_PER_DAY = 0.15;
const HR_SLOPE_THRESHOLD_BPM_PER_DAY = 3;
const SPO2_SLOPE_THRESHOLD_PCT_PER_DAY = -1;
const PAIN_SLOPE_THRESHOLD_PER_DAY = 1;

/**
 * Horizon beyond which a projected envelope crossing is no longer reported.
 * The regression window itself is capped at MAX_WINDOW (7) trailing days, so
 * a projection several multiples of that out is extrapolation on extrapolation
 * — informative as "not soon" but not as a specific day count. 30 days (~4x
 * the window) is chosen as the point past which we say nothing rather than
 * assert a number nobody should act on.
 */
const PROJECTION_HORIZON_DAYS = 30;

interface WindowPoint {
  reading: VitalsReading;
  symptoms: Symptoms;
}

interface RegressionPoint {
  tDays: number;
  value: number;
}

interface RegressionResult {
  slope: number;
  first: RegressionPoint;
  last: RegressionPoint;
  spanDays: number;
}

/**
 * Pairs each reading with its parallel symptoms entry, DROPS any reading
 * whose timestamp does not parse (policy: reject, don't guess — see module
 * docstring), sorts the remainder by actual timestamp (never assumed
 * pre-sorted), then keeps at most the trailing MAX_WINDOW entries.
 */
function toWindow(history: VitalsReading[], symptoms: Symptoms[]): WindowPoint[] {
  const paired: WindowPoint[] = history.map((reading, i) => ({
    reading,
    symptoms: symptoms[i] ?? {},
  }));

  const withValidTimestamp = paired.filter(
    (p) => !Number.isNaN(Date.parse(p.reading.timestamp)),
  );

  const sorted = [...withValidTimestamp].sort(
    (a, b) => Date.parse(a.reading.timestamp) - Date.parse(b.reading.timestamp),
  );

  return sorted.slice(Math.max(0, sorted.length - MAX_WINDOW));
}

/** Extracts usable (non-missing) points for one metric, deriving elapsed
 * days from each reading's own timestamp relative to the first usable point
 * for THIS metric — never from array index, and never guessing a value for
 * a reading where the metric is absent. */
function extractPoints(
  window: WindowPoint[],
  getValue: (p: WindowPoint) => number | undefined,
): RegressionPoint[] {
  const usable = window
    .map((p) => ({ p, value: getValue(p) }))
    .filter((x): x is { p: WindowPoint; value: number } => x.value !== undefined);

  if (usable.length < MIN_POINTS) {
    return [];
  }

  const t0 = Date.parse(usable[0].p.reading.timestamp);
  return usable.map((x) => ({
    tDays: (Date.parse(x.p.reading.timestamp) - t0) / MS_PER_DAY,
    value: x.value,
  }));
}

/** Ordinary least-squares slope of value regressed on elapsed days.
 * Returns undefined when there is no time variance to regress against
 * (all usable points share the same timestamp) rather than dividing by
 * zero. */
function leastSquaresSlope(points: RegressionPoint[]): number | undefined {
  const n = points.length;
  const tMean = points.reduce((sum, p) => sum + p.tDays, 0) / n;
  const yMean = points.reduce((sum, p) => sum + p.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const dt = p.tDays - tMean;
    numerator += dt * (p.value - yMean);
    denominator += dt * dt;
  }

  if (denominator === 0) {
    return undefined;
  }

  return numerator / denominator;
}

function regress(points: RegressionPoint[]): RegressionResult | undefined {
  if (points.length < MIN_POINTS) {
    return undefined;
  }

  const slope = leastSquaresSlope(points);
  if (slope === undefined) {
    return undefined;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return { slope, first, last, spanDays: last.tDays - first.tDays };
}

function formatSpan(spanDays: number): string {
  const rounded = Math.round(spanDays);
  if (rounded <= 0) {
    return "under a day";
  }
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Days until, at the fitted slope, `lastValue` would cross `bound` (the
 * root of `lastValue + slope * t = bound`). Returns undefined — meaning "omit
 * the projection" — when:
 *  - the slope is exactly zero (never crosses the bound at all);
 *  - the root `t` is <= 0. This single check covers BOTH cases the brief
 *    calls out separately: a slope pointing away from the bound and a value
 *    that has already crossed it, because solving for `t` produces a
 *    non-positive root in exactly those two situations (the bound lies
 *    behind the current trajectory, not ahead of it); or
 *  - the crossing is beyond PROJECTION_HORIZON_DAYS — implausibly far out to
 *    report as a specific day count.
 */
function daysUntilBreach(
  lastValue: number,
  slope: number,
  bound: number,
): number | undefined {
  if (slope === 0) {
    return undefined;
  }
  const t = (bound - lastValue) / slope;
  if (t <= 0 || t > PROJECTION_HORIZON_DAYS) {
    return undefined;
  }
  return t;
}

function formatDays(days: number): string {
  const rounded = Math.max(1, Math.round(days));
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

/**
 * Builds the trailing "projected breach" sentence appended to a finding's
 * description, using the phase's own `normalEnvelope` bound — e.g. "At this
 * rate, she crosses the Early protected phase's expected maximum of 100 bpm
 * in 5 days." Returns an empty string (nothing appended) when
 * `daysUntilBreach` says the projection should be omitted.
 */
function projectionClause(
  lastValue: number,
  slope: number,
  bound: number,
  phaseName: string,
  unit: string,
  boundLabel: "maximum" | "minimum",
): string {
  const days = daysUntilBreach(lastValue, slope, bound);
  if (days === undefined) {
    return "";
  }
  return (
    ` At this rate, she crosses the ${phaseName} phase's expected ${boundLabel} ` +
    `of ${bound}${unit} in ${formatDays(days)}.`
  );
}

function hrFinding(window: WindowPoint[], phase: Phase): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.hr));
  if (!result || result.slope < HR_SLOPE_THRESHOLD_BPM_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.hr.rising",
    metric: "hr",
    severity: "amber",
    description:
      `Resting heart rate has risen from ${result.first.value} to ${result.last.value} bpm ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)} bpm/day).` +
      projectionClause(
        result.last.value,
        result.slope,
        phase.normalEnvelope.hrMax,
        phase.name,
        " bpm",
        "maximum",
      ),
  };
}

function spo2Finding(window: WindowPoint[], phase: Phase): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.spo2));
  if (!result || result.slope > SPO2_SLOPE_THRESHOLD_PCT_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.spo2.falling",
    metric: "spo2",
    severity: "amber",
    description:
      `Oxygen saturation has fallen from ${result.first.value}% to ${result.last.value}% ` +
      `over ${formatSpan(result.spanDays)} (${round1(result.slope)} %/day).` +
      projectionClause(
        result.last.value,
        result.slope,
        phase.normalEnvelope.spo2Min,
        phase.name,
        "%",
        "minimum",
      ),
  };
}

function tempFinding(window: WindowPoint[], phase: Phase): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.tempC));
  if (!result || result.slope < TEMP_SLOPE_THRESHOLD_C_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.tempc.rising",
    metric: "tempC",
    severity: "amber",
    description:
      `Temperature has risen from ${result.first.value}\u00B0C to ${result.last.value}\u00B0C ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)}\u00B0C/day).` +
      projectionClause(
        result.last.value,
        result.slope,
        phase.normalEnvelope.tempCMax,
        phase.name,
        "\u00B0C",
        "maximum",
      ),
  };
}

/**
 * No projected-breach clause here: `Phase.normalEnvelope` has no pain bound
 * (only tempCMax/hrMax/spo2Min), so there is nothing to project a crossing
 * against for this metric. A rising pain score is reported as an
 * observation only.
 */
function painScoreFinding(window: WindowPoint[]): TrendFinding | undefined {
  // Prefer the per-reading painScore persisted on the vitals row; fall back
  // to the parallel symptoms array so fixture-driven tests keep working.
  const result = regress(
    extractPoints(window, (p) => p.reading.painScore ?? p.symptoms.painScore),
  );
  if (!result || result.slope < PAIN_SLOPE_THRESHOLD_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.pain_score.rising",
    metric: "painScore",
    severity: "amber",
    description:
      `Reported pain score has risen from ${result.first.value} to ${result.last.value} ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)}/day).`,
  };
}

/**
 * Findings only — this function NEVER returns a Decision and never decides
 * an escalation level on its own. The fixed per-day rate thresholds are
 * phase-independent by design (a given rate of change is equally concerning
 * at any recovery stage) — but `phase` IS read: it supplies the
 * `normalEnvelope` bound each finding projects its trajectory against (see
 * `projectionClause`), turning "rising" into "crosses the expected maximum
 * of X in N days."
 */
export function evaluateTrends(
  history: VitalsReading[],
  symptoms: Symptoms[],
  phase: Phase,
): TrendFinding[] {
  const window = toWindow(history, symptoms);
  if (window.length < MIN_POINTS) {
    return [];
  }

  return [
    hrFinding(window, phase),
    spo2Finding(window, phase),
    tempFinding(window, phase),
    painScoreFinding(window),
  ].filter((f): f is TrendFinding => f !== undefined);
}
