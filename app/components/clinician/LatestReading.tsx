import {
  bpStatus,
  hrStatus,
  sourceLabel,
  spo2Status,
  tempStatus,
  type VitalStatus,
} from "@/app/components/call/readouts";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { EcgReading, Phase, VitalsReading } from "@/lib/clinical/types";
import { callLength, clockTime } from "./format";

/**
 * The most recent reading, each number next to the bound it was judged
 * against.
 *
 * These chips come from the same `readouts.ts` the live call view uses, and
 * they say "In range" / "Above range" rather than "Urgent" for the reason
 * documented there: one number is not a triage decision. The verdict is the
 * severity panel above; this is the evidence beside it.
 */

const ECG_LABEL: Record<EcgReading["determination"], string> = {
  normal_sinus_rhythm: "Normal sinus rhythm",
  atrial_fibrillation: "Atrial fibrillation",
  tachycardia: "Tachycardia",
  bradycardia: "Bradycardia",
  unclassified: "Unclassified",
};

function Row({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  status: VitalStatus | undefined;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0">
      <p className="w-32 shrink-0 text-meta text-ink-secondary">{label}</p>
      <p className="flex w-24 shrink-0 items-baseline gap-1">
        <span className="numeric text-xl leading-none font-medium text-ink">
          {value}
        </span>
        <span className="text-meta text-ink-tertiary">{unit}</span>
      </p>
      {status ? <SeverityChip level={status.level} label={status.label} size="sm" /> : null}
      <p className="numeric ml-auto text-meta text-ink-tertiary">{status?.envelope}</p>
    </div>
  );
}

export function LatestReading({
  vitals,
  ecg,
  phase,
  painScore,
  callSeconds,
}: {
  vitals: VitalsReading;
  ecg: EcgReading | undefined;
  phase: Phase;
  painScore: number | undefined;
  callSeconds: number;
}) {
  return (
    <div className="space-y-1">
      <Row
        label="Heart rate"
        value={vitals.hr === undefined ? "—" : String(vitals.hr)}
        unit="bpm"
        status={hrStatus(vitals.hr, phase)}
      />
      <Row
        label="Oxygen saturation"
        value={vitals.spo2 === undefined ? "—" : String(vitals.spo2)}
        unit="%"
        status={spo2Status(vitals.spo2, phase)}
      />
      <Row
        label="Temperature"
        value={vitals.tempC === undefined ? "—" : vitals.tempC.toFixed(1)}
        unit="°C"
        status={tempStatus(vitals.tempC, phase)}
      />
      <Row
        label="Blood pressure"
        value={
          vitals.sbp === undefined || vitals.dbp === undefined
            ? "—"
            : `${vitals.sbp}/${vitals.dbp}`
        }
        unit="mmHg"
        status={bpStatus(vitals.sbp)}
      />
      <Row
        label="Reported pain"
        value={painScore === undefined ? "—" : String(painScore)}
        unit="/ 10"
        status={undefined}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3">
        <p className="numeric text-meta text-ink-tertiary">
          {sourceLabel(vitals)} · quality {vitals.quality} · resp{" "}
          {vitals.respRate ?? "—"} /min
        </p>
        <p className="numeric text-meta text-ink-tertiary">
          {clockTime(vitals.timestamp)} · call {callLength(callSeconds)}
        </p>
      </div>
      <p className="numeric text-meta text-ink-tertiary">
        Last ECG: {ecg ? `${ECG_LABEL[ecg.determination]} · KardiaMobile 6L` : "none on file"}
        {ecg?.bpm !== undefined ? ` · ${ecg.bpm} bpm` : ""}
      </p>
    </div>
  );
}
