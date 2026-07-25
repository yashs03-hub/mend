import { buildTimeline } from "@/app/components/call/timeline";
import type { CallStageProps } from "@/app/components/call/CallStage";
import { composeDecision } from "@/lib/clinical/compose";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { DEFAULT_PATIENT_FIRST_NAME, firstName, scriptForDecision } from "@/lib/clinical/scripts";
import { evaluateTrends } from "@/lib/clinical/trends";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { lastCheckinSummary } from "@/lib/memory/last-checkin";
import { loadActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "@/lib/sim/fixtures";
import { resolveCallStage } from "@/lib/sim/resolve-demo";

/**
 * Shared CallStage prop loader for `/call` and the clinician hub embed.
 *
 * Everything clinical is produced by the deterministic engine at load time over
 * shipped fixtures (+ optional Supabase identity). Scenario resolution:
 * query/option overrides → active console store → green default.
 */

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

export type LoadCallStageOptions = {
  /** Raw `?stage=` value. */
  stageParam?: string;
  /** When true and stage is not explicit, play from cursor 0. */
  play?: boolean;
  /** Raw `?speed=` value. */
  speedParam?: string;
};

/** Props for `<CallStage />` excluding layout `variant` (caller sets that). */
export type LoadedCallStageProps = Omit<CallStageProps, "variant">;

export async function loadCallStageProps(
  options: LoadCallStageOptions = {},
): Promise<LoadedCallStageProps> {
  const activeScenario = await loadActiveScenario();
  const stageParam = options.stageParam;
  const hasExplicitStage =
    stageParam === "monitoring" || stageParam === "checking" || stageParam === "escalated";
  const playing = Boolean(options.play) && !hasExplicitStage;
  const stage = resolveCallStage(stageParam, activeScenario, { playing });
  const speed = parseSpeed(options.speedParam);

  const identity = await loadIdentity();
  const { dayPostOp } = identity;
  const phase = getPhase(dayPostOp);

  const recalled = identity.id ? await lastCheckinSummary(identity.id) : "";

  const now = new Date();
  const baselineVitals =
    activeScenario === "drift"
      ? scenarioVitals("drift", now)
      : scenarioVitals("green", now);
  const acuteVitals = scenarioVitals("pe", now);

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

  return {
    patient: {
      id: identity.id,
      firstName: identity.firstName,
      age: PATIENT_AGE,
      procedure: identity.procedure,
    },
    dayPostOp,
    phase,
    ecg: scenarioEcg(
      activeScenario === "pe" ? "pe" : activeScenario === "drift" ? "drift" : "green",
    ),
    baselineVitals,
    events,
    openingDecision: routineDecision,
    priorSummary: recalled || FALLBACK_PRIOR_SUMMARY,
    stage,
    playing,
    speed,
  };
}
