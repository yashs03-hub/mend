"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SeverityChip, SeverityPanel } from "@/components/ui/severity-chip";
import type {
  Decision,
  EcgReading,
  Phase,
  VitalsReading,
} from "@/lib/clinical/types";
import { cn } from "@/lib/utils";
import {
  bpStatus,
  hrStatus,
  sourceLabel,
  spo2Status,
  tempStatus,
  type VitalStatus,
} from "./readouts";
import { formatCallClock } from "./timeline";

/**
 * The right half of the stage view while the call is going well: what the
 * engine is measuring, and the envelope it is measuring against.
 *
 * The envelope is on screen deliberately. When the heart rate climbs past it
 * a few seconds later, the audience has already read the number it had to
 * beat — the escalation then looks like arithmetic rather than like an
 * opinion.
 */

const LABEL = "text-eyebrow font-medium uppercase";

/**
 * Eases a reading toward its new value so a heart rate climbing from 76 to
 * 122 is watched rather than merely noticed. Frozen frames and reduced
 * motion snap straight to the value.
 */
const CLIMB_MS = 1600;

function useEasedNumber(target: number | undefined, animate: boolean): number | undefined {
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    shown.current = value;
  }, [value]);

  useEffect(() => {
    if (target === undefined || !animate) {
      shown.current = target;
      setValue(target);
      return;
    }

    const from = shown.current ?? target;
    if (from === target) return;

    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const t = Math.min(1, (now - startedAt) / CLIMB_MS);
      // easeOutCubic: fast off the mark, settles onto the value.
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [target, animate]);

  return value;
}

function LiveBadge({ source, animate }: { source: string; animate: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-2.5 py-1">
      <span className="relative flex size-2">
        {animate ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ink opacity-60" />
        ) : null}
        <span className="relative inline-flex size-2 rounded-full bg-ink" />
      </span>
      <span className={cn(LABEL, "text-ink-secondary")}>Live</span>
      <span className="numeric text-meta text-ink-tertiary">{source}</span>
    </span>
  );
}

function Tile({
  label,
  value,
  unit,
  status,
  reading,
  badge,
}: {
  label: string;
  value: string;
  unit: string;
  status: VitalStatus | undefined;
  /** Reads as a sentence for a screen reader. */
  reading: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-raised p-5 shadow-card 2xl:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className={cn(LABEL, "text-ink-tertiary")}>{label}</p>
        {badge}
      </div>

      <p className="flex flex-1 items-center" aria-label={reading}>
        <span aria-hidden="true" className="flex items-baseline gap-2">
          <span className="numeric text-vital font-medium text-ink 2xl:text-[3.5rem]">
            {value}
          </span>
          <span className="text-label text-ink-tertiary">{unit}</span>
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {status ? <SeverityChip level={status.level} label={status.label} size="sm" /> : null}
        <p className="numeric text-meta text-ink-tertiary">{status?.envelope}</p>
      </div>
    </div>
  );
}

const ECG_LABEL: Record<EcgReading["determination"], string> = {
  normal_sinus_rhythm: "Normal sinus rhythm",
  atrial_fibrillation: "Atrial fibrillation",
  tachycardia: "Tachycardia",
  bradycardia: "Bradycardia",
  unclassified: "Unclassified",
};

export function LiveVitals({
  vitals,
  phase,
  dayPostOp,
  decision,
  ecg,
  elapsed,
  animate: animateProp,
  className,
}: {
  vitals: VitalsReading;
  phase: Phase;
  dayPostOp: number;
  decision: Decision;
  ecg: EcgReading | undefined;
  /** Seconds into the call, used to stamp the reading without a wall clock. */
  elapsed: number;
  animate: boolean;
  className?: string;
}) {
  // The pulsing live indicator is markup, so it must not depend on a media
  // query the server cannot read — globals.css collapses its duration under
  // reduced motion instead. The climbing heart rate is state, so it can.
  const reduceMotion = useReducedMotion();
  const animate = animateProp;
  const hr = useEasedNumber(vitals.hr, animate && reduceMotion !== true);
  const envelope = phase.normalEnvelope;

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-5 2xl:gap-7", className)}>
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className={cn(LABEL, "text-ink-tertiary")}>Recovery phase</p>
          <p className="numeric text-meta text-ink-tertiary">
            Day {dayPostOp} of {phase.dayEnd + 1}
          </p>
        </div>
        <h2 className="font-heading text-heading text-ink">{phase.name}</h2>
        <p className="numeric text-meta text-ink-secondary">
          Expected today — HR ≤ {envelope.hrMax} bpm · SpO₂ ≥ {envelope.spo2Min}% · Temp ≤{" "}
          {envelope.tempCMax.toFixed(1)} °C
        </p>
      </header>

      <SeverityPanel level={decision.level} className="shrink-0">
        <p className="font-serif text-lede leading-snug text-ink-secondary">
          {decision.action}
        </p>
      </SeverityPanel>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 2xl:gap-6">
        <Tile
          label="Heart rate"
          value={hr === undefined ? "—" : String(hr)}
          unit="bpm"
          status={hrStatus(vitals.hr, phase)}
          reading={
            vitals.hr === undefined
              ? "Heart rate not available"
              : `Heart rate ${vitals.hr} beats per minute, ${hrStatus(vitals.hr, phase)?.label.toLowerCase()} for day ${dayPostOp}`
          }
          badge={<LiveBadge source={sourceLabel(vitals)} animate={animate} />}
        />
        <Tile
          label="Oxygen"
          value={vitals.spo2 === undefined ? "—" : String(vitals.spo2)}
          unit="%"
          status={spo2Status(vitals.spo2, phase)}
          reading={
            vitals.spo2 === undefined
              ? "Oxygen saturation not available"
              : `Oxygen saturation ${vitals.spo2} percent, ${spo2Status(vitals.spo2, phase)?.label.toLowerCase()} for day ${dayPostOp}`
          }
        />
        <Tile
          label="Temperature"
          value={vitals.tempC === undefined ? "—" : vitals.tempC.toFixed(1)}
          unit="°C"
          status={tempStatus(vitals.tempC, phase)}
          reading={
            vitals.tempC === undefined
              ? "Temperature not available"
              : `Temperature ${vitals.tempC.toFixed(1)} degrees Celsius, ${tempStatus(vitals.tempC, phase)?.label.toLowerCase()} for day ${dayPostOp}`
          }
        />
        <Tile
          label="Blood pressure"
          value={
            vitals.sbp === undefined || vitals.dbp === undefined
              ? "—"
              : `${vitals.sbp}/${vitals.dbp}`
          }
          unit="mmHg"
          status={bpStatus(vitals.sbp)}
          reading={
            vitals.sbp === undefined || vitals.dbp === undefined
              ? "Blood pressure not available"
              : `Blood pressure ${vitals.sbp} over ${vitals.dbp} millimetres of mercury`
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn(LABEL, "text-ink-tertiary")}>Last ECG</span>
          <span className="text-label text-ink-secondary">
            {ecg ? ECG_LABEL[ecg.determination] : "None on file"}
          </span>
          {ecg?.bpm !== undefined ? (
            <span className="numeric text-meta text-ink-tertiary">
              {ecg.bpm} bpm · KardiaMobile 6L
            </span>
          ) : null}
        </p>
        <p className="numeric text-meta text-ink-tertiary">
          {vitals.respRate !== undefined ? `Resp ${vitals.respRate} /min · ` : ""}
          reading at {formatCallClock(elapsed)}
        </p>
      </div>
    </div>
  );
}
