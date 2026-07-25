import { Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { CheckinStrip, type CheckinDay } from "@/app/components/family/CheckinStrip";
import { familyCopy } from "@/app/components/family/copy";
import { SeverityChip } from "@/components/ui/severity-chip";
import { composeDecision } from "@/lib/clinical/compose";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluateTrends } from "@/lib/clinical/trends";
import type { Decision, Symptoms, TrendFinding, VitalsReading } from "@/lib/clinical/types";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildFallbackSbar } from "@/lib/llm/sbar";
import { familyRecallSummary } from "@/lib/memory/last-checkin";
import { getActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals, type Scenario } from "@/lib/sim/fixtures";
import { resolveFamilyScenario } from "@/lib/sim/resolve-demo";

/**
 * /family — the daughter's view, read on a phone at work.
 *
 * She has one question: "is Mom all right, or do I need to drive over?"
 * Everything on this screen answers it; anything that doesn't is left off.
 * No vitals numbers, no rule ids, no thresholds — those live on the
 * clinician view. The level itself still comes from the deterministic
 * engine over the shipped fixtures; only the words are translated for a
 * family reader (app/components/family/copy.ts).
 *
 * Scenario resolution (query param > active console store > green):
 *   /family                    active scenario from the console store
 *   /family?state=attention    drift fixture (harness / deep link)
 *   /family?state=well         green fixture (harness / deep link)
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mom's recovery — Mend",
  description: "A calm daily update on Margaret's recovery, from Mend's morning call.",
};

/** Matches the call view's synthetic patient (schema seed: surgery 4 days ago). */
const DAY_POST_OP = 4;
const PROCEDURE = "Hip hemiarthroplasty";
/** NANP 555 fictional range; never a real number. */
const MOM_TEL = "+15550100123";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** What the fixtures don't model: same voice as the call timeline's turns. */
const WELL_SUMMARY =
  "She said the pain keeps easing, she slept through the night, and she's been up and about with her walker.";

interface FamilyState {
  decision: Decision;
  findings: TrendFinding[];
  history: VitalsReading[];
}

/** Never blocks the page: missing Supabase just means no recall sentence. */
async function loadFamilyRecall(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) return "";
  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) return "";
    return familyRecallSummary(patient.id);
  } catch {
    return "";
  }
}

/** Scenario-appropriate symptom fixtures so the engine path matches the
 * console's pe / green / drift demos — never a hand-authored severity. */
function symptomsFor(scenario: Scenario): Symptoms {
  if (scenario === "pe") {
    return { breathless: true, chestPain: true, painScore: 4, painControlled: true };
  }
  return { painScore: 3, painControlled: true, breathless: false };
}

/** Both verdicts come from the engine over the shipped fixtures — the level
 * on this screen is never authored copy. */
function loadState(scenario: Scenario): FamilyState {
  const history = scenarioHistory(scenario);
  const findings = evaluateTrends(
    history,
    history.map(() => ({})),
    getPhase(DAY_POST_OP),
  );
  const symptoms = symptomsFor(scenario);
  const base = evaluate({
    dayPostOp: DAY_POST_OP,
    symptoms,
    vitals: scenarioVitals(scenario, new Date()),
    ecg: scenarioEcg(scenario),
  });
  return { decision: composeDecision(base, findings), findings, history };
}

function formatCallTime(date: Date): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "\u00A0");
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** The trailing seven calendar days; a day counts as checked in when any
 * reading in the fixture history lands on it. Presence only — the values
 * on those days never reach this surface. */
function lastSevenDays(history: VitalsReading[], now: Date): CheckinDay[] {
  const checked = new Set(
    history
      .map((r) => new Date(r.timestamp))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map(localDayKey),
  );

  const days: CheckinDay[] = [];
  for (let ago = 6; ago >= 0; ago--) {
    const day = new Date(now.getTime() - ago * MS_PER_DAY);
    days.push({
      key: localDayKey(day),
      letter: day.toLocaleDateString("en-US", { weekday: "narrow" }),
      name: day.toLocaleDateString("en-US", { weekday: "long" }),
      checkedIn: checked.has(localDayKey(day)),
      isToday: ago === 0,
    });
  }
  return days;
}

/** The SBAR travels to a clinician by email; it is never rendered here. */
function forwardHref(state: FamilyState): string {
  const sbar = buildFallbackSbar({
    patient: "Margaret",
    dayPostOp: DAY_POST_OP,
    procedure: PROCEDURE,
    decision: state.decision,
    symptoms: { painScore: 3, painControlled: true, breathless: false },
    vitals: state.history[state.history.length - 1],
    ecg: scenarioEcg("drift"),
    trendFindings: state.findings,
  });
  const subject = "Mend update on Margaret — needs attention today";
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sbar)}`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scenario = resolveFamilyScenario(first(params.state), getActiveScenario());

  const state = loadState(scenario);
  const copy = familyCopy(state.decision, state.findings);
  const recall = await loadFamilyRecall();
  const now = new Date();
  const days = lastSevenDays(state.history, now);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-12 pb-10 sm:pt-16">
      <p className="font-sans text-family-eyebrow font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        Mend &middot; Recovery updates
      </p>

      <div className="pt-10">
        <SeverityChip level={state.decision.level} size="lg" />
      </div>

      <h1 className="pt-6 font-heading text-heading text-balance sm:text-title">
        {copy.headline}
      </h1>

      <p className="pt-5 text-lg text-ink-secondary">
        Mend called her today at <time>{formatCallTime(now)}</time>.
      </p>

      {copy.whatHappened ? (
        <>
          <p className="pt-6 font-serif text-lede text-ink">{copy.whatHappened}</p>
          <p className="pt-5 font-serif text-lede text-ink">{copy.whatMendAsked}</p>
          {recall ? (
            <p className="pt-3 text-lg text-ink-secondary">{recall}</p>
          ) : null}

          <div className="flex flex-col gap-3 pt-10">
            <a
              href={`tel:${MOM_TEL}`}
              className="flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-ink text-lg font-medium text-paper"
            >
              <Phone aria-hidden="true" className="size-5" strokeWidth={2} />
              Call Mom
            </a>
            <a
              href={forwardHref(state)}
              className="flex min-h-14 items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-raised text-lg font-medium text-ink"
            >
              <Send aria-hidden="true" className="size-5" strokeWidth={2} />
              Forward the care summary
            </a>
          </div>
        </>
      ) : (
        <p className="pt-6 font-serif text-lede text-ink">{WELL_SUMMARY}</p>
      )}

      <div className="mt-auto pt-16">
        <CheckinStrip days={days} />
        <p className="pt-8 text-lg text-ink-tertiary">Mend calls her every morning.</p>
        <MedicalAdviceDisclaimer tone="family" className="pt-6" />
      </div>
    </main>
  );
}
