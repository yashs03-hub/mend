"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { Badge } from "@/components/ui/badge";
import type {
  Decision,
  EcgReading,
  Phase,
  VitalsReading,
} from "@/lib/clinical/types";
import { cn } from "@/lib/utils";
import { EscalationTakeover } from "./EscalationTakeover";
import { LiveVitals } from "./LiveVitals";
import { TranscriptStream } from "./TranscriptStream";
import {
  formatCallClock,
  resolveState,
  stageCursor,
  type CallEvent,
  type CallStage as Stage,
} from "./timeline";
import { useCallRealtime, type RealtimeCheckin } from "./use-realtime";

/**
 * The stage view. Left is the conversation, right is the clinical state, and
 * the whole screen is driven by one cursor into the call (see timeline.ts).
 *
 * Three ways to drive it, all reading the same reducer:
 *  - `?play=1` runs the call unattended at the pace of the real phone call.
 *  - the arrow keys and space step or pause it, for a presenter on stage.
 *  - `?stage=` freezes it on a named frame, which is how both the demo's
 *    fallback and the screenshot harness get a deterministic screen.
 *
 * Supabase Realtime, when configured, supersedes the fixtures: a vitals row
 * repaints the tiles and a check-in row appends the turn and its verdict. It
 * is additive on purpose — a missing key degrades the page to the scripted
 * fixtures rather than to an empty screen.
 */

const LABEL = "text-eyebrow font-medium uppercase";

export interface CallStageProps {
  patient: {
    firstName: string;
    age: number;
    procedure: string;
    /** Present only when Supabase is configured and seeded. */
    id: string | undefined;
  };
  dayPostOp: number;
  phase: Phase;
  ecg: EcgReading | undefined;
  baselineVitals: VitalsReading;
  events: CallEvent[];
  openingDecision: Decision;
  /** Prior-check-in recall the agent was primed with, if there is any. */
  priorSummary?: string;
  /** Frozen frame. Undefined means playback. */
  stage: Stage | undefined;
  playing: boolean;
  speed: number;
  /**
   * `stage` is the full-bleed /call projector layout (default).
   * `hub` is a compact embed for the clinician hub live pane.
   */
  variant?: "stage" | "hub";
}

function PulseDot({ animate }: { animate: boolean }) {
  return (
    <span className="relative flex size-2.5" aria-hidden="true">
      {animate ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ink opacity-60" />
      ) : null}
      <span className="relative inline-flex size-2.5 rounded-full bg-ink" />
    </span>
  );
}

export function CallStage({
  patient,
  dayPostOp,
  phase,
  ecg,
  baselineVitals,
  events,
  openingDecision,
  priorSummary,
  stage,
  playing: initiallyPlaying,
  speed,
  variant = "stage",
}: CallStageProps) {
  const isHub = variant === "hub";
  const initialCursor = stageCursor(events, stage ?? "monitoring");
  const startCursor = initiallyPlaying ? 0 : initialCursor;

  const [cursor, setCursor] = useState(startCursor);
  const [playing, setPlaying] = useState(initiallyPlaying);

  // Realtime supersedes the fixtures when it has something to say.
  const [liveVitals, setLiveVitals] = useState<VitalsReading>();
  const [liveEvents, setLiveEvents] = useState<CallEvent[]>([]);
  const [liveDecision, setLiveDecision] = useState<Decision>();

  const scripted = resolveState(events, cursor, {
    decision: openingDecision,
    vitals: baselineVitals,
  });

  const onCheckin = useCallback(
    ({ decision, transcript }: RealtimeCheckin) => {
      setLiveDecision(decision);
      setLiveEvents((prior) => {
        const n = prior.length;
        const at = scripted.elapsed;
        const next: CallEvent[] = [];
        if (transcript) {
          next.push({
            kind: "turn",
            id: `live-turn-${n}`,
            at,
            speaker: "margaret",
            text: transcript,
          });
        }
        next.push({
          kind: "tool-start",
          id: `live-start-${n}`,
          at,
          endpoint: "POST /api/checkin",
          inputs: [{ key: "dayPostOp", value: String(dayPostOp) }],
        });
        next.push({
          kind: "tool-result",
          id: `live-result-${n}`,
          at,
          startId: `live-start-${n}`,
          latencyMs: 0,
          decision,
        });
        return [...prior, ...next];
      });
    },
    [dayPostOp, scripted.elapsed],
  );

  // Side-effect only: live rows supersede fixtures when keys exist. Status
  // strings stay on /console — never on this judge-facing stage.
  useCallRealtime({
    patientId: patient.id,
    onVitals: setLiveVitals,
    onCheckin,
  });

  const vitals = liveVitals ?? scripted.vitals;
  const decision = liveDecision ?? scripted.decision;
  const visible = useMemo(
    () => [...scripted.visible, ...liveEvents],
    [scripted.visible, liveEvents],
  );

  // The header clock keeps running between turns so the call reads as live.
  // It is seeded from the scripted timings and never from a wall clock, which
  // would differ between the server and the client render; whichever of the
  // two is further into the call wins, so stepping by hand jumps it forward.
  const [seconds, setSeconds] = useState(scripted.elapsed);
  const elapsed = Math.max(seconds, scripted.elapsed);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  const lastIndex = events.length - 1;
  const atEnd = cursor >= lastIndex;

  useEffect(() => {
    if (!playing || atEnd) return;
    const from = cursor < 0 ? 0 : events[cursor].at;
    const gap = Math.max(0.4, events[cursor + 1].at - from);
    const id = setTimeout(() => setCursor((c) => c + 1), (gap * 1000) / speed);
    return () => clearTimeout(id);
  }, [playing, atEnd, cursor, events, speed]);

  // Motion stays off for a frozen capture frame, and switches on the moment
  // a presenter drives the call by hand.
  const [interactive, setInteractive] = useState(initiallyPlaying);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;

      if (key === " ") {
        event.preventDefault();
        setInteractive(true);
        setPlaying((p) => !p);
      } else if (key === "ArrowRight" || key === "ArrowLeft") {
        event.preventDefault();
        setInteractive(true);
        setPlaying(false);
        setCursor((c) => Math.max(0, Math.min(lastIndex, c + (key === "ArrowRight" ? 1 : -1))));
      } else if (key.toLowerCase() === "r") {
        setInteractive(true);
        setCursor(0);
        setSeconds(0);
        setLiveEvents([]);
        setLiveDecision(undefined);
        setLiveVitals(undefined);
        setPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastIndex]);

  const escalated = decision.level === "red";
  const animate = interactive;

  return (
    <div
      className={cn(
        "flex flex-col bg-paper",
        isHub
          ? "min-h-[28rem] lg:min-h-[32rem] lg:overflow-hidden"
          : "min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-between border-b border-line",
          isHub
            ? "gap-x-6 gap-y-2 px-4 py-2.5 lg:px-6"
            : "gap-x-10 gap-y-4 px-6 py-4 lg:px-10 2xl:px-14 2xl:py-5",
        )}
      >
        <div className={cn("flex flex-wrap items-center", isHub ? "gap-x-4 gap-y-1" : "gap-x-6 gap-y-2")}>
          {!isHub ? (
            <>
              <p className="font-heading text-subhead leading-none text-ink">Mend</p>
              <span aria-hidden="true" className="hidden h-6 w-px bg-line-strong sm:block" />
            </>
          ) : null}
          <div className={isHub ? "space-y-0.5" : "space-y-1"}>
            <p
              className={cn(
                "font-medium text-ink",
                isHub ? "text-meta" : "text-label 2xl:text-lg",
              )}
            >
              {patient.firstName}
              <span className="numeric text-ink-secondary"> · {patient.age}</span>
            </p>
            <p
              className={cn(
                "numeric text-ink-tertiary",
                isHub ? "text-meta" : "text-meta 2xl:text-label",
              )}
            >
              {patient.procedure} · day {dayPostOp} · {phase.name.toLowerCase()} phase
            </p>
          </div>
          <Badge variant="outline">Synthetic patient</Badge>
        </div>

        <div className={cn("flex items-center", isHub ? "gap-4" : "gap-6")}>
          <p className="flex items-center justify-end gap-2.5">
            <PulseDot animate={animate} />
            <span className={cn(LABEL, "text-ink-secondary")}>
              {playing ? "On the call" : "Call in progress"}
            </span>
          </p>
          <p
            className={cn(
              "numeric leading-none font-medium text-ink",
              isHub ? "text-subhead" : "text-heading",
            )}
          >
            {formatCallClock(elapsed)}
          </p>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <section
          className={cn(
            "flex min-h-0 flex-col border-line lg:border-r",
            isHub
              ? "px-4 py-4 lg:px-6 lg:py-5"
              : "px-6 py-6 lg:px-10 lg:py-8 2xl:px-14 2xl:py-10",
          )}
        >
          <TranscriptStream
            events={visible}
            patientName={patient.firstName}
            priorSummary={priorSummary}
            animate={animate}
            className="flex-1"
          />
          {!isHub && initiallyPlaying ? (
            <p className="numeric shrink-0 pt-5 text-meta text-ink-tertiary">
              Space pauses · → steps forward · R restarts
            </p>
          ) : null}
        </section>

        <section
          className={cn(
            "relative min-h-0 bg-wash",
            isHub
              ? "px-4 py-4 lg:px-6 lg:py-5"
              : "px-6 py-6 lg:px-10 lg:py-8 2xl:px-14 2xl:py-10",
          )}
        >
          <LiveVitals
            vitals={vitals}
            phase={phase}
            dayPostOp={dayPostOp}
            // Underneath the takeover the pane keeps its pre-escalation
            // verdict, so the red field wipes over a calm surface rather than
            // over a second red one.
            decision={escalated ? openingDecision : decision}
            ecg={ecg}
            elapsed={elapsed}
            animate={animate}
          />
          <AnimatePresence initial={false}>
            {escalated ? (
              <EscalationTakeover
                key="takeover"
                decision={decision}
                vitals={vitals}
                phase={phase}
                elapsed={elapsed}
              />
            ) : null}
          </AnimatePresence>
        </section>
      </main>

      {/* Page footer — outside the absolute red takeover, so the peak frame
          keeps one instruction and the honesty line still ships. */}
      <footer
        className={cn(
          "shrink-0 border-t border-line",
          isHub ? "px-4 py-2 lg:px-6" : "px-6 py-3 lg:px-10 2xl:px-14",
        )}
      >
        <MedicalAdviceDisclaimer />
      </footer>
    </div>
  );
}
