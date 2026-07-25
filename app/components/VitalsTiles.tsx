"use client";

import { useEffect, useRef } from "react";
import { Phase, VitalsReading } from "@/lib/clinical/types";

type Tone = "ok" | "warn" | "crit";

/**
 * Tone is derived from the same phase envelope the engine uses, so a tile can
 * never show a calm colour for a number the engine is escalating on.
 */
function hrTone(hr: number | undefined, phase: Phase): Tone {
  if (hr === undefined) return "warn";
  if (hr > 110) return "crit";
  if (hr > phase.normalEnvelope.hrMax) return "warn";
  return "ok";
}

function tempTone(t: number | undefined, phase: Phase): Tone {
  if (t === undefined) return "warn";
  if (t >= 38.5) return "crit";
  if (t > phase.normalEnvelope.tempCMax) return "warn";
  return "ok";
}

function bpTone(sbp: number | undefined): Tone {
  if (sbp === undefined) return "warn";
  if (sbp < 90) return "crit";
  if (sbp < 100) return "warn";
  return "ok";
}

const BEAT: [number, number][] = [
  [0.0, 0], [0.14, 0], [0.18, -0.12], [0.22, 0], [0.3, 0],
  [0.4, 0.06], [0.44, -0.95], [0.48, 0.3], [0.52, 0], [0.6, 0],
  [0.72, -0.24], [0.82, 0], [1.0, 0],
];

function EcgTrace({ rate, tone }: { rate: number; tone: Tone }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 200;
      const h = canvas.clientHeight || 34;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const mid = h * 0.62;
      const amp = h * 0.4;
      const beats = Math.max(3, Math.round(rate / 20));
      const bw = w / beats;
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue(`--${tone}`)
        .trim();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let b = 0; b < beats; b++) {
        for (let i = 0; i < BEAT.length; i++) {
          const x = b * bw + BEAT[i][0] * bw;
          const y = mid + BEAT[i][1] * amp;
          if (b === 0 && i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(w, mid);
      ctx.stroke();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [rate, tone]);

  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height: 34, display: "block", marginTop: 8 }}
      aria-label={`Lead II rhythm strip at ${rate} beats per minute`}
      role="img"
    />
  );
}

function Tile({
  label,
  value,
  unit,
  sub,
  tone,
  pill,
  children,
}: {
  label: string;
  value?: string;
  unit?: string;
  sub: string;
  tone: Tone;
  pill: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{ padding: "13px 14px", position: "relative", overflow: "hidden" }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `var(--${tone})`,
        }}
      />
      <div
        className="klabel"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        {label}
        <span
          className="mono"
          style={{
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 20,
            fontWeight: 600,
            letterSpacing: 0,
            background: `var(--${tone}-soft)`,
            color: `var(--${tone})`,
          }}
        >
          {pill}
        </span>
      </div>
      {value !== undefined && (
        <div
          className="mono"
          style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6, lineHeight: 1 }}
        >
          {value}
          {unit && (
            <small style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, marginLeft: 3 }}>
              {unit}
            </small>
          )}
        </div>
      )}
      {children}
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 7 }}>
        {sub}
      </div>
    </div>
  );
}

export function VitalsTiles({
  vitals,
  phase,
}: {
  vitals: VitalsReading;
  phase: Phase;
}) {
  const unusable = vitals.quality !== "ok";
  const hrT = hrTone(vitals.hr, phase);
  const ecgLabel = vitals.ecgFlags?.[0]?.replace(/_/g, " ") ?? "no trace";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 14,
      }}
    >
      <Tile
        label="Heart rate"
        value={vitals.hr !== undefined ? String(vitals.hr) : "—"}
        unit={vitals.hr !== undefined ? "bpm" : undefined}
        sub={unusable ? "Reading not usable" : ecgLabel}
        tone={hrT}
        pill={hrT === "crit" ? "High" : hrT === "warn" ? "Watch" : "Normal"}
      />
      <Tile
        label="Blood pressure"
        value={
          vitals.sbp !== undefined && vitals.dbp !== undefined
            ? `${vitals.sbp}/${vitals.dbp}`
            : "—"
        }
        unit={vitals.sbp !== undefined ? "mmHg" : undefined}
        sub={
          vitals.sbp !== undefined && vitals.dbp !== undefined
            ? `MAP ~${Math.round((vitals.sbp + 2 * vitals.dbp) / 3)}`
            : "Reading not usable"
        }
        tone={bpTone(vitals.sbp)}
        pill={bpTone(vitals.sbp) === "ok" ? "Normal" : bpTone(vitals.sbp) === "warn" ? "Watch" : "Low"}
      />
      <Tile
        label="Temperature"
        value={vitals.tempC !== undefined ? vitals.tempC.toFixed(1) : "—"}
        unit={vitals.tempC !== undefined ? "°C" : undefined}
        sub={`Envelope ≤ ${phase.normalEnvelope.tempCMax} (${phase.name.toLowerCase()})`}
        tone={tempTone(vitals.tempC, phase)}
        pill={tempTone(vitals.tempC, phase) === "ok" ? "In range" : "Above envelope"}
      />
      <Tile
        label="3-lead ECG"
        sub={`Lead II · ${ecgLabel}`}
        tone={hrT}
        pill={vitals.ecgFlags?.includes("sinus_tachycardia") ? "Sinus tachy" : "Sinus"}
      >
        {vitals.hr !== undefined && <EcgTrace rate={vitals.hr} tone={hrT} />}
      </Tile>
    </div>
  );
}
