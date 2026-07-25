"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { TrendFinding } from "@/lib/clinical/types";
import { SEVERITY } from "@/lib/ui/severity";
import type { TrendSeries } from "./trend-series";

/**
 * One metric over the trailing fortnight, drawn against the phase envelope.
 *
 * The envelope is a filled band rather than a stated number, because a breach
 * has to be *seen*. A dashed line at a threshold makes the reader do the
 * comparison; a shaded region makes the eye do it — the point that leaves the
 * band is outside before anyone has read the axis. Each point carries its own
 * bounds, so the band steps where the recovery phase changes instead of
 * pretending one envelope covered the whole window.
 *
 * The band is `stepAfter`: an envelope is a rule that holds for a day and
 * then changes, not a quantity that slides between two values, and
 * interpolating it would draw a diagonal that was never anyone's threshold.
 *
 * Colour still isn't allowed to carry the meaning on its own. A breach is a
 * larger ringed dot AND a severity chip in the chart header AND a sentence in
 * the caption, so the chart survives a projector that eats the red.
 */

const INK = "#1c1917";
const INK_TERTIARY = "#78716c";
const LINE = "#e7e2dc";
const WASH_STRONG = "#efeae1";
const LINE_STRONG = "#d8d1c7";

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { breach?: boolean };
}

function Dot({ cx, cy, index, payload }: DotProps) {
  if (cx === undefined || cy === undefined) return null;

  if (payload?.breach) {
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={7} fill={SEVERITY.red.bg} stroke="none" />
        <circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill={SEVERITY.red.fg}
          stroke={SEVERITY.red.bg}
          strokeWidth={2}
        />
      </g>
    );
  }

  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={2.5} fill={INK} />;
}

interface TooltipEntry {
  payload?: { day: number; value: number | null; band?: [number, number] | null; breach?: boolean };
}

function ChartTooltip({
  active,
  payload,
  unit,
  precision,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  unit: string;
  precision: number;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.value === null) return null;

  return (
    <div className="rounded-md border border-line-strong bg-raised px-3 py-2 shadow-card">
      <p className="numeric text-meta text-ink-tertiary">Day {point.day}</p>
      <p className="numeric text-label font-medium text-ink">
        {point.value.toFixed(precision)} {unit}
      </p>
      {point.band ? (
        <p className="numeric text-meta text-ink-tertiary">
          envelope {point.band[0].toFixed(precision)}–{point.band[1].toFixed(precision)}
          {point.breach ? " · outside" : ""}
        </p>
      ) : null}
    </div>
  );
}

export function TrendChart({
  series,
  trend,
}: {
  series: TrendSeries;
  /** The trend finding for this metric, when the trajectory engine raised one. */
  trend?: TrendFinding;
}) {
  const hasBand = series.points.some((p) => p.band !== null);
  const data = series.points.map((p) => ({
    day: p.day,
    value: p.value,
    band: p.band ?? undefined,
    breach: p.breach,
  }));

  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-raised p-5 shadow-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h3 className="font-heading text-lg leading-none text-ink">{series.title}</h3>
          <p className="numeric text-meta text-ink-tertiary">{series.envelopeLabel}</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {trend ? (
            <SeverityChip
              level={trend.severity}
              size="sm"
              label="rising on trajectory"
            />
          ) : null}
          {series.breaches > 0 ? (
            <SeverityChip
              level="red"
              size="sm"
              label={`${series.breaches} outside envelope`}
            />
          ) : (
            <SeverityChip level="green" size="sm" label="inside envelope" />
          )}
        </span>
      </figcaption>

      {trend ? (
        <p className="border-l-2 border-line-strong pl-3 text-meta text-ink-secondary">
          <span className="numeric font-medium text-ink">{trend.id}</span> —{" "}
          {trend.description}
        </p>
      ) : null}

      <div
        className="h-[190px] w-full"
        role="img"
        aria-label={`${series.title} over ${series.points.length} days, ${series.envelopeLabel}. ${
          series.breaches === 0
            ? "Every reading is inside the envelope."
            : `${series.breaches} readings are outside the envelope.`
        }`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={LINE} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: LINE }}
              tick={{ fill: INK_TERTIARY, fontSize: 12 }}
              tickFormatter={(day: number) => `d${day}`}
              minTickGap={12}
            />
            <YAxis
              domain={series.domain}
              ticks={series.ticks}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: INK_TERTIARY, fontSize: 12 }}
              tickFormatter={(value: number) => value.toFixed(series.precision)}
            />

            {hasBand ? (
              <Area
                dataKey="band"
                type="stepAfter"
                fill={WASH_STRONG}
                fillOpacity={1}
                stroke={INK_TERTIARY}
                strokeWidth={1}
                strokeDasharray="5 3"
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
                name="Expected range"
              />
            ) : null}

            {series.phaseChangeDays.map((day) => (
              <ReferenceLine
                key={day}
                x={day}
                stroke={LINE_STRONG}
                strokeWidth={1}
                label={{
                  value: "phase change",
                  position: "insideTopLeft",
                  fill: INK_TERTIARY,
                  fontSize: 11,
                }}
              />
            ))}

            <Line
              dataKey="value"
              type="linear"
              stroke={INK}
              strokeWidth={1.75}
              isAnimationActive={false}
              connectNulls
              dot={<Dot />}
              activeDot={{ r: 4, fill: INK, stroke: "#ffffff", strokeWidth: 2 }}
              name={series.title}
            />

            <Tooltip
              cursor={{ stroke: LINE_STRONG, strokeWidth: 1 }}
              content={
                <ChartTooltip unit={series.unit} precision={series.precision} />
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-meta text-ink-tertiary">
        {hasBand ? (
          <>
            <span className="mr-1.5 inline-block h-2.5 w-4 translate-y-px rounded-[2px] border border-dashed border-ink-tertiary bg-wash-strong align-middle" />
            Shaded band is the recovery-phase envelope for that day.{" "}
          </>
        ) : (
          <>No envelope band. </>
        )}
        Source: <span className="italic">{series.envelopeSource}</span>
      </p>
    </figure>
  );
}
