"use client";

import { AlertTriangle, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CallStage, type CallStageProps } from "@/app/components/call/CallStage";
import { SeverityPanel } from "@/components/ui/severity-chip";
import { Button } from "@/components/ui/button";
import {
  getLiveCall,
  startLiveCall,
  subscribeLiveCall,
} from "@/lib/sim/live-call";
import type { RosterPatient } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { HubOpsPanel } from "./HubOpsPanel";
import { LatestReading } from "./LatestReading";
import { Panel, SectionHeading } from "./ClinicianShell";
import { clockTime, fullDate, timeAgo } from "./format";
import { pickDefaultPatientId } from "./hub-selection";
import { PracticeSummary } from "./PracticeSummary";
import { SbarCard } from "./SbarCard";
import { Worklist } from "./Worklist";

type CallActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

function CallStatus({ state }: { state: CallActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 text-label text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Placing call…
      </p>
    );
  }
  const tone =
    state.kind === "error"
      ? "border-severity-red-border bg-severity-red-bg text-severity-red-fg"
      : "border-line bg-wash text-ink-secondary";
  return (
    <p
      role={state.kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-label",
        tone,
      )}
    >
      {state.kind === "error" ? (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : null}
      <span>{state.message}</span>
    </p>
  );
}

function useLiveCallActive(): boolean {
  return useSyncExternalStore(
    subscribeLiveCall,
    () => getLiveCall().active,
    () => false,
  );
}

function ChartSummary({
  patient,
  now,
}: {
  patient: RosterPatient;
  now: Date;
}) {
  const latest = patient.latest;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <h2 className="font-heading text-subhead text-ink">{patient.name}</h2>
          <p className="numeric flex flex-wrap items-baseline gap-x-3 gap-y-1 text-label text-ink-secondary">
            <span>{patient.age}</span>
            <span aria-hidden="true" className="text-ink-tertiary">
              ·
            </span>
            <span>{patient.procedure}</span>
            <span aria-hidden="true" className="text-ink-tertiary">
              ·
            </span>
            <span className="font-medium text-ink">Day {patient.dayPostOp}</span>
            <span aria-hidden="true" className="text-ink-tertiary">
              ·
            </span>
            <span>{patient.phase.name}</span>
          </p>
        </div>
        <Link
          href={`/clinician/${patient.id}`}
          className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
        >
          Open full chart
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SeverityPanel
            level={latest.decision.level}
            headline={latest.decision.condition ?? undefined}
          >
            <p className="font-serif text-lede leading-snug text-ink-secondary">
              {latest.decision.action}
            </p>
            <p className="numeric pt-2 text-meta">
              Day {latest.dayPostOp} check-in at {clockTime(latest.at)} ·{" "}
              {timeAgo(latest.at, now)} · fired{" "}
              {latest.decision.firedRules.join(", ") || "no rule"}
            </p>
          </SeverityPanel>

          <Panel className="p-5">
            <SectionHeading
              title="SBAR handoff"
              meta={`generated for day ${latest.dayPostOp}`}
            />
            <div className="pt-4">
              <SbarCard sbar={latest.sbar} patientName={patient.name} />
            </div>
          </Panel>
        </div>

        <Panel className="p-5">
          <SectionHeading
            title="Latest reading"
            meta={`day ${latest.dayPostOp} · ${patient.phase.name}`}
          />
          <div className="pt-3">
            <LatestReading
              vitals={latest.vitals}
              ecg={latest.ecg}
              phase={patient.phase}
              painScore={latest.symptoms.painScore}
              callSeconds={latest.callSeconds}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ClinicianHub({
  patients,
  nowIso,
  persistence,
  callStageProps,
}: {
  patients: RosterPatient[];
  nowIso: string;
  persistence: string;
  callStageProps: Omit<CallStageProps, "variant">;
}) {
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const liveActive = useLiveCallActive();

  const [selectedId, setSelectedId] = useState(
    () => pickDefaultPatientId(patients) ?? patients[0]?.id ?? "",
  );
  const [focusLive, setFocusLive] = useState(false);
  const [callState, setCallState] = useState<CallActionState>({ kind: "idle" });
  const [opsOpen, setOpsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#ops") {
      setOpsOpen(true);
    }
    const onHash = () => {
      if (window.location.hash === "#ops") setOpsOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (searchParams.get("live") === "1" && liveActive) {
      setFocusLive(true);
    }
  }, [searchParams, liveActive]);

  useEffect(() => {
    if (liveActive) setFocusLive(true);
  }, [liveActive]);

  const selected =
    patients.find((p) => p.id === selectedId) ??
    patients.find((p) => p.id === pickDefaultPatientId(patients)) ??
    patients[0];

  const showLive = focusLive && liveActive;

  const callNow = useCallback(async () => {
    setCallState({ kind: "pending" });
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "clinician" }),
      });
      const json = (await res.json()) as {
        status?: string;
        reason?: string;
        conversationId?: string | null;
        source?: string;
      };
      if (!res.ok || json.status === "skipped" || json.status === "error") {
        setCallState({
          kind: "error",
          message:
            json.reason ??
            `Call failed (${res.status}). Check DEMO_PATIENT_PHONE and ElevenLabs credentials.`,
        });
        return;
      }
      startLiveCall({
        conversationId: json.conversationId ?? null,
        source: "clinician",
      });
      setFocusLive(true);
      setCallState({
        kind: "ok",
        message: json.conversationId
          ? `Call placed (${json.conversationId}). Answer on speaker — press any key at the Twilio trial message, then Mend speaks.`
          : "Call placed. Answer on speaker — press any key at the Twilio trial message, then Mend speaks.",
      });
    } catch {
      setCallState({ kind: "error", message: "Could not reach /api/call." });
    }
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-8 pb-2">
        <div className="space-y-1.5">
          <h1 className="font-heading text-heading text-ink">Clinician hub</h1>
          <p className="max-w-3xl text-label text-ink-secondary">
            Worklist, chart, and live check-in in one place. Every verdict below is
            the deterministic engine&apos;s, computed at render time.
          </p>
        </div>
        <p className="numeric text-meta text-ink-tertiary">
          {fullDate(nowIso)} · reading from {persistence}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-label font-medium text-ink">Call now</p>
          <p className="max-w-xl text-meta text-ink-secondary">
            <span className="font-medium text-ink">Twilio trial:</span> answer on
            speaker, then <span className="font-medium text-ink">press any key</span>{" "}
            when you hear the trial message — Mend starts after that.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/family"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
          >
            Open family view
          </Link>
          <Button
            type="button"
            size="lg"
            onClick={() => void callNow()}
            disabled={callState.kind === "pending"}
            className="min-h-12"
          >
            {callState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Phone aria-hidden="true" className="size-4" />
            )}
            Call now
          </Button>
        </div>
      </div>
      <CallStatus state={callState} />

      <PracticeSummary patients={patients} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionHeading
            title="Patients"
            meta={`${patients.length} monitored · worst first`}
          />
          <Worklist
            patients={patients}
            now={now}
            selectedId={selected?.id}
            onSelect={(id) => {
              setSelectedId(id);
              if (!liveActive) setFocusLive(false);
            }}
          />
          <p className="text-meta text-ink-tertiary">
            Select a row for the chart summary. Open full chart for trends, billing,
            and the rule audit trail.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          {showLive ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionHeading
                  title="Live check-in"
                  meta={
                    callStageProps.patient.firstName
                      ? `${callStageProps.patient.firstName} · embedded`
                      : "embedded"
                  }
                />
                <button
                  type="button"
                  onClick={() => setFocusLive(false)}
                  className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
                >
                  Show chart
                </button>
              </div>
              <CallStage {...callStageProps} variant="hub" />
            </div>
          ) : selected ? (
            <ChartSummary patient={selected} now={now} />
          ) : (
            <p className="text-label text-ink-secondary">No patients on the roster.</p>
          )}

          {liveActive && !showLive ? (
            <p className="rounded-lg border border-line bg-wash px-4 py-3 text-label text-ink-secondary">
              A live check-in is in progress.{" "}
              <button
                type="button"
                onClick={() => setFocusLive(true)}
                className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                Return to live session
              </button>
            </p>
          ) : null}
        </div>
      </div>

      <section id="ops" className="scroll-mt-24 space-y-4 border-t border-line pt-8">
        <details
          open={opsOpen}
          onToggle={(e) => setOpsOpen((e.target as HTMLDetailsElement).open)}
          className="group"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg border border-line bg-raised px-4 py-3 text-label font-medium text-ink shadow-card marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ops — scenario, vitals, ECG, BLE, transcript</span>
            <span className="numeric text-meta font-normal text-ink-tertiary group-open:hidden">
              Show
            </span>
            <span className="numeric hidden text-meta font-normal text-ink-tertiary group-open:inline">
              Hide
            </span>
          </summary>
          <div className="pt-5">
            <HubOpsPanel />
          </div>
        </details>
      </section>

      <p className="max-w-4xl text-meta text-ink-tertiary">
        Synthetic patients. No protected health information is present in this
        repository, and no database credentials are required to render this page —
        with Supabase configured the same components read stored check-ins instead.
      </p>
    </div>
  );
}
