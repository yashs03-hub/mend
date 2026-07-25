import type { Metadata } from "next";
import { CallStage } from "@/app/components/call/CallStage";
import { buildTimeline } from "@/app/components/call/timeline";
import { composeDecision } from "@/lib/clinical/compose";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { DEFAULT_PATIENT_FIRST_NAME, firstName, scriptForDecision } from "@/lib/clinical/scripts";
import { evaluateTrends } from "@/lib/clinical/trends";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { lastCheckinSummary } from "@/lib/memory/last-checkin";
import { getActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "@/lib/sim/fixtures";
import { resolveCallStage } from "@/lib/sim/resolve-demo";

/**
 * /call — the live call view, projected behind the presenter.
 *
 * Everything clinical on this page is produced by the deterministic engine at
 * render time. The green verdict, the red verdict, the condition, the fired
 * rule ids and the sentence Mend speaks are all outputs of `evaluate()` and
 * `scriptForDecision()` run over the shipped fixtures — none of them is copy
 * written into a component. If a rule threshold changes, this screen changes
 * with it, which is the only way a demo screen can honestly claim to be
 * showing the engine.
 *
 * Supabase supplies the patient's identity and the id the client subscribes
 * to for realtime. With no credentials — the state a teammate cloning the
 * repo is in — the page renders identically from fixtures.
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

/** Matches lib/db/schema.sql's seed (surgery_date = current_date - 4). */
const DEFAULT_DAY_POST_OP = 4;
const DEFAULT_PROCEDURE = "Hip hemiarthroplasty";
/** Part of the synthetic patient's story, not of any stored clinical record. */
const PATIENT_AGE = 82;

/**
 * Stands in for `lastCheckinSummary()` when there is no stored check-in to
 * recall — same voice and same shape as the real sentence, and deliberately
 * consistent with the opener in the scripted timeline.
 */
const FALLBACK_PRIOR_SUMMARY =
  "Yesterday you rated your pain 4 out of 10 and reported no breathlessness.";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(isoDate: string): number | undefined {
  const surgery = Date.parse(isoDate);
  if (Number.isNaN(surgery)) return undefined;
  const days = Math.floor((Date.now() - surgery) / MS_PER_DAY);
  return days >= 0 ? days : undefined;
}

interface DemoIdentity {
  id: string | undefined;
  firstName: string;
  procedure: string;
  dayPostOp: number;
}

/** Never throws and never blocks the page: a missing, slow or unseeded
 * database degrades to the synthetic identity the fixtures assume. */
async function loadIdentity(): Promise<DemoIdentity> {
  const fallback: DemoIdentity = {
    id: undefined,
    firstName: DEFAULT_PATIENT_FIRST_NAME,
    procedure: DEFAULT_PROCEDURE,
    dayPostOp: DEFAULT_DAY_POST_OP,
  };

  const supabase = getSupabaseClient();
  if (!supabase) return fallback;

  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) return fallback;

    return {
      id: patient.id,
      firstName: firstName(patient.name),
      procedure: patient.procedure
        ? patient.procedure[0].toUpperCase() + patient.procedure.slice(1)
        : DEFAULT_PROCEDURE,
      dayPostOp: daysSince(patient.surgeryDate) ?? DEFAULT_DAY_POST_OP,
    };
  } catch {
    return fallback;
  }
}

function parseSpeed(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(8, Math.max(0.25, parsed)) : 1;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CallPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const activeScenario = getActiveScenario();
  const stageParam = first(params.stage);
  const hasExplicitStage =
    stageParam === "monitoring" || stageParam === "checking" || stageParam === "escalated";
  const playing = first(params.play) === "1" && !hasExplicitStage;
  const stage = resolveCallStage(stageParam, activeScenario, { playing });
  const speed = parseSpeed(first(params.speed));

  const identity = await loadIdentity();
  const { dayPostOp } = identity;
  const phase = getPhase(dayPostOp);

  // The same sentence Task 13 injects into the agent's opener, shown so the
  // audience can see that the call started from memory rather than cold.
  const recalled = identity.id ? await lastCheckinSummary(identity.id) : "";

  const now = new Date();
  // Calm band uses the active scenario when it is green/drift; the PE
  // escalation arc always needs a well baseline then the acute pe reading.
  const baselineVitals =
    activeScenario === "drift"
      ? scenarioVitals("drift", now)
      : scenarioVitals("green", now);
  const acuteVitals = scenarioVitals("pe", now);

  // Both verdicts come from the engine, over the shipped fixtures.
  const routineBase = evaluate({
    dayPostOp,
    symptoms: { painScore: 3, painControlled: true, breathless: false },
    vitals: baselineVitals,
    ecg: scenarioEcg(activeScenario === "drift" ? "drift" : "green"),
  });
  const driftFindings =
    activeScenario === "drift"
      ? evaluateTrends(
          scenarioHistory("drift"),
          scenarioHistory("drift").map(() => ({})),
          phase,
        )
      : [];
  const routineDecision = composeDecision(routineBase, driftFindings);
  const escalationDecision = evaluate({
    dayPostOp,
    symptoms: { breathless: true },
    vitals: acuteVitals,
    ecg: scenarioEcg("pe"),
  });

  const events = buildTimeline({
    dayPostOp,
    baselineVitals,
    acuteVitals,
    routineDecision,
    escalationDecision,
    escalationScript: scriptForDecision(escalationDecision, identity.firstName),
  });

  return (
    <CallStage
      patient={{
        id: identity.id,
        firstName: identity.firstName,
        age: PATIENT_AGE,
        procedure: identity.procedure,
      }}
      dayPostOp={dayPostOp}
      phase={phase}
      ecg={scenarioEcg(activeScenario === "pe" ? "pe" : activeScenario === "drift" ? "drift" : "green")}
      baselineVitals={baselineVitals}
      events={events}
      openingDecision={routineDecision}
      priorSummary={recalled || FALLBACK_PRIOR_SUMMARY}
      stage={stage}
      playing={playing}
      speed={speed}
    />
  );
}
