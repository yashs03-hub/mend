"use client";

import { Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { Button } from "@/components/ui/button";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { Severity } from "@/lib/clinical/types";
import { startLiveCall } from "@/lib/sim/live-call";

type CallActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export interface PatientPortalProps {
  patientName: string;
  dayPostOp: number;
  procedure: string;
  level: Severity;
  headline: string;
  lede: string;
}

function CallStatus({ state }: { state: CallActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 pt-4 text-lg text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        Calling you now…
      </p>
    );
  }
  const tone =
    state.kind === "error"
      ? "border-severity-red-border bg-severity-red-bg text-severity-red-fg"
      : "border-line bg-wash text-ink";
  return (
    <p className={`mt-4 rounded-xl border px-4 py-3 text-lg leading-relaxed ${tone}`}>
      {state.message}
    </p>
  );
}

export function PatientPortal({
  patientName,
  dayPostOp,
  procedure,
  level,
  headline,
  lede,
}: PatientPortalProps) {
  const [callState, setCallState] = useState<CallActionState>({ kind: "idle" });

  const requestCheckIn = useCallback(async () => {
    setCallState({ kind: "pending" });
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "patient" }),
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
            `Call failed (${res.status}). Please try again in a moment.`,
        });
        return;
      }
      startLiveCall({
        conversationId: json.conversationId ?? null,
        source: "patient",
      });
      setCallState({
        kind: "ok",
        message:
          "Mend is calling you now. Answer on speaker — press any key when you hear the Twilio trial message, then Mend speaks.",
      });
    } catch {
      setCallState({
        kind: "error",
        message: "Could not reach Mend. Please try again in a moment.",
      });
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-12 pb-10 sm:pt-16">
      <p className="font-sans text-family-eyebrow font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        Mend &middot; Your recovery
      </p>

      <p className="pt-8 text-lg text-ink-secondary">
        {patientName} · day {dayPostOp} after {procedure.toLowerCase()}
      </p>

      <div className="pt-8">
        <SeverityChip level={level} size="lg" />
      </div>

      <h1 className="pt-6 font-heading text-heading text-balance sm:text-title">
        {headline}
      </h1>

      <p className="pt-5 font-serif text-lede text-ink">{lede}</p>

      <div className="flex flex-col gap-3 pt-10">
        <Button
          type="button"
          size="lg"
          onClick={() => void requestCheckIn()}
          disabled={callState.kind === "pending"}
          className="min-h-14 w-full rounded-xl text-lg"
        >
          {callState.kind === "pending" ? (
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <Phone aria-hidden="true" className="size-5" strokeWidth={2} />
          )}
          Request a check-in call
        </Button>
        <Link
          href="/family"
          className="flex min-h-14 items-center justify-center rounded-xl border border-line-strong bg-raised text-lg font-medium text-ink"
        >
          Open family updates
        </Link>
      </div>

      <CallStatus state={callState} />

      <p className="pt-6 text-lg text-ink-secondary">
        <span className="font-medium text-ink">Twilio trial:</span> answer on
        speaker, then <span className="font-medium text-ink">press any key</span>{" "}
        when you hear the trial message — Mend starts after that.
      </p>

      <div className="mt-auto pt-16">
        <p className="text-lg text-ink-tertiary">
          Mend can call you now when you ask, and every morning.
        </p>
        <MedicalAdviceDisclaimer tone="family" className="pt-6" />
      </div>
    </main>
  );
}
