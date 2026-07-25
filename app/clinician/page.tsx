import type { Metadata } from "next";
import { Suspense } from "react";
import { loadCallStageProps } from "@/app/components/call/load-call-stage-props";
import { ClinicianHub } from "@/app/components/clinician/ClinicianHub";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildRoster } from "@/lib/sim/roster";

/**
 * /clinician — the clinician's daily hub.
 *
 * Worklist selection, chart summary, Call now → embedded live session, and
 * Ops tools (scenario / vitals / ECG / BLE / transcript). Renders from
 * synthetic roster fixtures without credentials.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clinician hub — Mend",
  description:
    "Post-op patients under remote monitoring: worklist, chart, and live check-in in one place.",
};

export default async function ClinicianPage() {
  const now = new Date();
  const patients = buildRoster(now);
  const persistence = getSupabaseClient() ? "Supabase" : "fixtures";
  const callStageProps = await loadCallStageProps();

  return (
    <ClinicianShell active="/clinician">
      <Suspense
        fallback={
          <div className="pt-8 text-label text-ink-secondary">Loading hub…</div>
        }
      >
        <ClinicianHub
          patients={patients}
          nowIso={now.toISOString()}
          persistence={persistence}
          callStageProps={callStageProps}
        />
      </Suspense>
    </ClinicianShell>
  );
}
