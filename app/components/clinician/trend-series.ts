import { getPhase } from "@/lib/clinical/recovery-graph";
import type { Symptoms, VitalsReading } from "@/lib/clinical/types";

/**
 * Turns a patient's readings into what a trend chart needs: one point per
 * post-op day carrying both the value and the envelope that applied *on that
 * day*.
 *
 * Carrying the envelope per point rather than per chart is the whole trick.
 * The recovery graph tightens at day 14 — hrMax 100 drops to 95, tempCMax
 * 38.0 to 37.5 — so a single pair of bounds drawn across a fortnight would be
 * a lie for half of it. Because each point brings its own bounds, the band
 * steps down where the phase changes, and a reading that was comfortably
 * normal on day 13 can be visibly outside on day 14 without the patient
 * having changed at all.
 *
 * Nothing here decides anything. Breach counts are drawn from the same
 * envelope numbers the red-flag engine reads, but the verdict on screen is
 * always `evaluate()`'s, never this.
 */

export type MetricKey = "hr" | "spo2" | "tempC" | "painScore";

export interface TrendPoint {
  day: number;
  value: number | null;
  /** [low, high] of the acceptable region on this day; null when undefined. */
  band: [number, number] | null;
  /** True when `value` falls outside `band`. */
  breach: boolean;
}

export interface TrendSeries {
  key: MetricKey;
  title: string;
  unit: string;
  points: TrendPoint[];
  /**
   * Y-axis bounds. The bounded side sits exactly on the envelope's floor or
   * ceiling so that edge of the band lands on the frame and only the edge
   * that means something is drawn inside the plot; the open side is padded.
   */
  domain: [number, number];
  /** Explicit axis ticks, always including the envelope bound in force. */
  ticks: number[];
  /** Decimal places for axis ticks and readouts. */
  precision: number;
  /** The bound in words, e.g. "expected ≤ 100 bpm, tightening to 95 from day 14". */
  envelopeLabel: string;
  /** Verbatim provenance for that bound, or the reason there isn't one. */
  envelopeSource: string;
  breaches: number;
  /** Days where the phase envelope changes, for a marker line. */
  phaseChangeDays: number[];
  latest: number | null;
}

const DAY_14_NOTE = "tightening from day 14";

interface MetricSpec {
  key: MetricKey;
  title: string;
  unit: string;
  precision: number;
  pad: number;
  /** Which end of the axis is free to grow; the other is pinned to the band. */
  padSide: "high" | "low" | "none";
  /** Used when the metric has no envelope at all. */
  fixedDomain?: [number, number];
  read: (vitals: VitalsReading, symptoms: Symptoms) => number | undefined;
  /** [low, high] for the day, or null when the phase graph defines no bound. */
  band: (day: number) => [number, number] | null;
  label: (days: readonly number[]) => string;
  source: (day: number) => string;
}

/** Floors chosen so the acceptable region reads as a region, not as the whole chart. */
const HR_FLOOR = 45;
const TEMP_FLOOR = 35.5;
const SPO2_CEILING = 100;

const METRICS: Record<MetricKey, MetricSpec> = {
  hr: {
    key: "hr",
    title: "Heart rate",
    unit: "bpm",
    precision: 0,
    pad: 8,
    padSide: "high",
    read: (v) => v.hr,
    band: (day) => [HR_FLOOR, getPhase(day).normalEnvelope.hrMax],
    label: (days) => boundLabel(days, (d) => `${getPhase(d).normalEnvelope.hrMax}`, "≤", "bpm"),
    source: (day) => getPhase(day).normalEnvelope.source,
  },
  spo2: {
    key: "spo2",
    title: "Oxygen saturation",
    unit: "%",
    precision: 0,
    pad: 2,
    padSide: "low",
    read: (v) => v.spo2,
    band: (day) => [getPhase(day).normalEnvelope.spo2Min, SPO2_CEILING],
    label: (days) => boundLabel(days, (d) => `${getPhase(d).normalEnvelope.spo2Min}`, "≥", "%"),
    source: (day) => getPhase(day).normalEnvelope.source,
  },
  tempC: {
    key: "tempC",
    title: "Temperature",
    unit: "°C",
    precision: 1,
    pad: 0.4,
    padSide: "high",
    read: (v) => v.tempC,
    band: (day) => [TEMP_FLOOR, getPhase(day).normalEnvelope.tempCMax],
    label: (days) =>
      boundLabel(days, (d) => getPhase(d).normalEnvelope.tempCMax.toFixed(1), "≤", "°C"),
    source: (day) => getPhase(day).normalEnvelope.source,
  },
  painScore: {
    key: "painScore",
    title: "Reported pain",
    unit: "/ 10",
    precision: 0,
    pad: 0,
    padSide: "none",
    fixedDomain: [0, 10],
    read: (_v, s) => s.painScore,
    band: () => null,
    label: () => "no envelope defined — watched on slope only",
    source: () =>
      "lib/clinical/recovery-graph.ts defines no pain bound. The trend engine watches " +
      "the slope (+1 point/day) instead of any single-reading threshold.",
  },
};

/** "expected ≤ 100 bpm" or, across a phase change, "≤ 100 bpm, tightening to 95 from day 14". */
function boundLabel(
  days: readonly number[],
  bound: (day: number) => string,
  comparator: "≤" | "≥",
  unit: string,
): string {
  const seen: string[] = [];
  for (const day of days) {
    const value = bound(day);
    if (seen[seen.length - 1] !== value) seen.push(value);
  }

  if (seen.length <= 1) {
    return `expected ${comparator} ${seen[0] ?? "—"} ${unit}`;
  }
  return `expected ${comparator} ${seen[0]} ${unit}, ${DAY_14_NOTE} to ${seen[seen.length - 1]}`;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Axis ticks: the two ends, the midpoint, and — most importantly — the
 * envelope bound in force, so the reader can read the threshold straight off
 * the axis. Ticks closer than a tenth of the range to a neighbour are
 * dropped, and the bound wins that contest, because a legible "95" matters
 * more than an evenly spaced one.
 */
function tickList(
  domain: [number, number],
  bound: number | undefined,
  precision: number,
): number[] {
  const [min, max] = domain;
  const span = max - min;
  if (span <= 0) return [min];

  // Priority order: the two ends, then the bound, then the midpoint.
  const ordered = [
    min,
    max,
    ...(bound !== undefined ? [bound] : []),
    round(min + span / 2, precision),
  ].filter((n) => n >= min && n <= max);

  const kept: number[] = [];
  for (const tick of ordered) {
    if (kept.every((k) => Math.abs(k - tick) >= span * 0.1)) kept.push(tick);
  }
  return kept.sort((a, b) => a - b);
}

export interface TrendInput {
  dayPostOp: number;
  vitals: VitalsReading;
  symptoms: Symptoms;
}

/** The trailing window, in days, that the charts cover. */
export const TREND_WINDOW_DAYS = 14;

export function buildTrendSeries(
  checkins: readonly TrendInput[],
  key: MetricKey,
  windowDays: number = TREND_WINDOW_DAYS,
): TrendSeries {
  const spec = METRICS[key];
  const window = checkins.slice(Math.max(0, checkins.length - windowDays));
  const days = window.map((c) => c.dayPostOp);

  const points: TrendPoint[] = window.map((checkin) => {
    const raw = spec.read(checkin.vitals, checkin.symptoms);
    const value = raw === undefined ? null : round(raw, spec.precision);
    const band = spec.band(checkin.dayPostOp);
    const breach =
      value !== null && band !== null && (value < band[0] || value > band[1]);

    return { day: checkin.dayPostOp, value, band, breach };
  });

  const numbers = points.flatMap((p) =>
    [p.value, p.band?.[0], p.band?.[1]].filter((n): n is number => n !== null && n !== undefined),
  );
  const low = numbers.length ? Math.min(...numbers) : 0;
  const high = numbers.length ? Math.max(...numbers) : 1;

  const domain: [number, number] = spec.fixedDomain ?? [
    round(spec.padSide === "low" ? low - spec.pad : low, spec.precision),
    round(spec.padSide === "high" ? high + spec.pad : high, spec.precision),
  ];

  // The bound in force on the latest day, so the axis itself names the
  // threshold the reader is being asked to compare against.
  const lastBand = [...points].reverse().find((p) => p.band !== null)?.band ?? null;
  const bound =
    lastBand === null
      ? undefined
      : spec.padSide === "low"
        ? lastBand[0]
        : lastBand[1];
  const ticks = tickList(domain, bound, spec.precision);

  const phaseChangeDays = points
    .filter(
      (point, index) =>
        index > 0 && getPhase(point.day).name !== getPhase(points[index - 1].day).name,
    )
    .map((point) => point.day);

  const latest = [...points].reverse().find((p) => p.value !== null)?.value ?? null;

  return {
    key,
    title: spec.title,
    unit: spec.unit,
    points,
    domain,
    ticks,
    precision: spec.precision,
    envelopeLabel: spec.label(days),
    envelopeSource: spec.source(days[days.length - 1] ?? 0),
    breaches: points.filter((p) => p.breach).length,
    phaseChangeDays,
    latest,
  };
}

export const TREND_METRICS: MetricKey[] = ["hr", "spo2", "tempC", "painScore"];
