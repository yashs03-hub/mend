"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import type { Decision, VitalsReading } from "@/lib/clinical/types";
import { parseDecision, parseVitalsRow } from "./readouts";

/**
 * Supabase Realtime for the stage view: new vitals rows and new check-in
 * decisions land on screen without a refresh.
 *
 * Degrades to nothing. With no `NEXT_PUBLIC_SUPABASE_*` keys — the state a
 * teammate cloning this repo is in — the hook reports "unavailable" and never
 * opens a socket, and the page runs on fixtures instead. A live call must
 * never be able to fail into a blank screen because a key is missing.
 *
 * Nothing arriving on the socket is trusted: every payload is re-validated
 * (`parseDecision`, `parseVitalsRow`) before it can touch the screen, so a
 * malformed row is dropped rather than painted as an unknown severity.
 */

export type RealtimeStatus = "unavailable" | "connecting" | "live" | "error";

export interface RealtimeCheckin {
  decision: Decision;
  transcript: string | null;
}

export function useCallRealtime({
  patientId,
  onVitals,
  onCheckin,
}: {
  patientId: string | undefined;
  onVitals: (reading: VitalsReading) => void;
  onCheckin: (checkin: RealtimeCheckin) => void;
}): RealtimeStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key && patientId);

  const [channelStatus, setChannelStatus] = useState<RealtimeStatus>("connecting");

  const vitalsRef = useRef(onVitals);
  const checkinRef = useRef(onCheckin);

  useEffect(() => {
    vitalsRef.current = onVitals;
    checkinRef.current = onCheckin;
  });

  useEffect(() => {
    if (!url || !key || !patientId) return;

    const client = createClient(url, key, { auth: { persistSession: false } });
    const filter = `patient_id=eq.${patientId}`;

    const channel = client
      .channel(`mend-call-${patientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vitals", filter },
        (payload) => {
          const reading = parseVitalsRow(payload.new);
          if (reading) vitalsRef.current(reading);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins", filter },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const decision = parseDecision(row.decision);
          if (!decision) return;
          checkinRef.current({
            decision,
            transcript: typeof row.transcript === "string" ? row.transcript : null,
          });
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setChannelStatus("live");
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setChannelStatus("error");
        else if (state === "CLOSED") setChannelStatus("connecting");
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [url, key, patientId]);

  return configured ? channelStatus : "unavailable";
}
