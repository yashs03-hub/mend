"use client";

import { AlertTriangle, Bluetooth, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  connectHeartRate,
  isWebBluetoothSupported,
  type HeartRateSession,
} from "@/lib/ble/heart-rate";
import type { VitalsReading } from "@/lib/clinical/types";
import { cn } from "@/lib/utils";

/**
 * Client-side floor on how often a reading is POSTed to `/api/vitals`. The
 * characteristic notifies roughly once per second while subscribed — at
 * that rate an unthrottled stream would be five inserts a second across a
 * multi-minute demo for no clinical benefit, since nothing consumes vitals
 * faster than a human reads them. The live number on screen still updates
 * every notification; only persistence is throttled.
 */
const MIN_POST_INTERVAL_MS = 5000;

type Phase =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; deviceLabel: string }
  | { kind: "disconnected"; deviceLabel: string }
  | { kind: "error"; message: string };

async function postVitalsReading(reading: VitalsReading): Promise<void> {
  try {
    const res = await fetch("/api/vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(reading),
    });
    if (!res.ok) {
      console.warn("[BleHeartRate] /api/vitals rejected the reading:", res.status);
    }
  } catch (err) {
    // Never let a flaky network turn a live demo reading into a thrown
    // error in the UI — persistence is best-effort, the on-screen number is
    // what matters on stage.
    console.warn("[BleHeartRate] failed to reach /api/vitals:", err);
  }
}

function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ink opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-ink" />
    </span>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-label text-ink-secondary">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-tertiary" />
      <p>{children}</p>
    </div>
  );
}

/**
 * Connect button + live BPM readout for a real Bluetooth heart rate
 * monitor (lib/ble/heart-rate.ts). Every failure mode called out in the
 * task brief is a distinct, visible, non-fatal `Phase` — none of them throw
 * or leave the component stuck on a spinner.
 */
export function BleHeartRate({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [bpm, setBpm] = useState<number | undefined>(undefined);
  const sessionRef = useRef<HeartRateSession | null>(null);
  const lastPostedAtRef = useRef(0);

  // `navigator.bluetooth` does not exist during SSR, so this must run on
  // the client after mount rather than at render time — doing it inline
  // would also make the server- and client-rendered markup disagree.
  useEffect(() => {
    if (!isWebBluetoothSupported()) {
      setPhase({ kind: "unsupported" });
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setPhase({ kind: "connecting" });

    const result = await connectHeartRate({
      onEvent: (event) => {
        if (event.type === "disconnected") {
          sessionRef.current = null;
          // A drop mid-demo must not be silently swallowed, but it also
          // must not stomp on a phase the user has already moved past
          // (e.g. having already clicked "Reconnect" and gone back to
          // "connecting") if this fires late.
          setPhase((prev) =>
            prev.kind === "connected"
              ? { kind: "disconnected", deviceLabel: prev.deviceLabel }
              : prev,
          );
          return;
        }

        setBpm(event.reading.bpm);

        const now = Date.now();
        if (now - lastPostedAtRef.current >= MIN_POST_INTERVAL_MS) {
          lastPostedAtRef.current = now;
          void postVitalsReading({
            timestamp: event.reading.timestamp,
            hr: event.reading.bpm,
            source: "ble_heart_rate",
            deviceLabel: event.reading.deviceLabel,
            quality: "ok",
          });
        }
      },
    });

    switch (result.outcome) {
      case "connected":
        sessionRef.current = result.session;
        setPhase({ kind: "connected", deviceLabel: result.session.deviceLabel });
        return;
      case "cancelled":
        // The user closed the device chooser. Not an error — back to idle.
        setPhase({ kind: "idle" });
        return;
      case "unsupported":
        setPhase({ kind: "unsupported" });
        return;
      case "error":
        setPhase({ kind: "error", message: result.message });
        return;
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setBpm(undefined);
    setPhase({ kind: "idle" });
  }, []);

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-line bg-raised p-5 shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-eyebrow font-medium text-ink-tertiary uppercase">
          Heart rate monitor
        </p>
        {phase.kind === "connected" ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-2.5 py-1">
            <LiveDot />
            <span className="text-eyebrow font-medium text-ink-secondary uppercase">Live</span>
          </span>
        ) : null}
      </div>

      {phase.kind === "unsupported" ? (
        <Message>
          This browser can&apos;t connect to a Bluetooth heart rate monitor. Web Bluetooth is
          only available in Chrome or Edge — open this page there to connect a watch.
        </Message>
      ) : null}

      {phase.kind === "idle" || phase.kind === "connecting" ? (
        <Button onClick={handleConnect} disabled={phase.kind === "connecting"}>
          {phase.kind === "connecting" ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Bluetooth aria-hidden="true" className="size-4" />
              Connect heart rate monitor
            </>
          )}
        </Button>
      ) : null}

      {phase.kind === "error" ? (
        <div className="space-y-3">
          <Message>{phase.message}</Message>
          <Button onClick={handleConnect} variant="outline">
            <Bluetooth aria-hidden="true" className="size-4" />
            Try again
          </Button>
        </div>
      ) : null}

      {phase.kind === "disconnected" ? (
        <div className="space-y-3">
          <Message>Lost connection to {phase.deviceLabel}.</Message>
          <Button onClick={handleConnect} variant="outline">
            <Bluetooth aria-hidden="true" className="size-4" />
            Reconnect
          </Button>
        </div>
      ) : null}

      {phase.kind === "connected" ? (
        <div className="space-y-3">
          <p
            className="flex items-baseline gap-1.5"
            aria-label={
              bpm === undefined
                ? "Waiting for the first heart rate reading"
                : `Heart rate ${bpm} beats per minute`
            }
          >
            <span aria-hidden="true" className="numeric text-vital font-medium text-ink">
              {bpm === undefined ? "—" : bpm}
            </span>
            <span aria-hidden="true" className="text-label text-ink-tertiary">
              bpm
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="numeric text-meta text-ink-tertiary">{phase.deviceLabel}</p>
            <Button onClick={handleDisconnect} variant="outline" size="sm">
              Disconnect
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
