import type { Metadata } from "next";
import { CallStage } from "@/app/components/call/CallStage";
import { loadCallStageProps } from "@/app/components/call/load-call-stage-props";

/**
 * /call — the live call view, projected behind the presenter.
 *
 * Everything clinical on this page is produced by the deterministic engine at
 * render time via `loadCallStageProps` (shared with the clinician hub embed).
 *
 * Scenario resolution (query param > active console store > green default):
 *   /call                    frame from the console's active scenario
 *                            (pe → escalated; green/drift → monitoring)
 *   /call?play=1             plays the call through at the real pace
 *   /call?stage=escalated    the red takeover, frozen (harness / deep link)
 *   /call?stage=checking     the engine mid-consultation, frozen
 *   /call?speed=2            playback multiplier
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live call — Mend",
  description:
    "Margaret's day-4 recovery call: the conversation on the left, the deterministic clinical state on the right.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CallPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const props = await loadCallStageProps({
    stageParam: first(params.stage),
    play: first(params.play) === "1",
    speedParam: first(params.speed),
  });

  return <CallStage {...props} />;
}
