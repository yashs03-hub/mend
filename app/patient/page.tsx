import type { Metadata } from "next";
import { PatientPortal } from "@/app/components/patient/PatientPortal";
import { patientCopy } from "@/app/components/patient/copy";
import { composeDecision } from "@/lib/clinical/compose";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluateTrends } from "@/lib/clinical/trends";
import type { Symptoms } from "@/lib/clinical/types";
import { loadActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals, type Scenario } from "@/lib/sim/fixtures";
import { resolveFamilyScenario } from "@/lib/sim/resolve-demo";

/**
 * /patient — Margaret's calm portal. Identity is prefilled for the demo;
 * the primary action requests an immediate check-in call via /api/call.
 *
 * Status uses the same engine path as /family so the headline reflects the
 * active demo scenario, in second-person plain English.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your recovery — Mend",
  description: "Request a Mend check-in call and see a plain update on your recovery.",
};

const DAY_POST_OP = 4;
const PROCEDURE = "Hip hemiarthroplasty";
const PATIENT_NAME = "Margaret";

function symptomsFor(scenario: Scenario): Symptoms {
  if (scenario === "pe") {
    return { breathless: true, chestPain: true, painScore: 4, painControlled: true };
  }
  return { painScore: 3, painControlled: true, breathless: false };
}

function loadDecision(scenario: Scenario) {
  const history = scenarioHistory(scenario);
  const findings = evaluateTrends(
    history,
    history.map(() => ({})),
    getPhase(DAY_POST_OP),
  );
  const base = evaluate({
    dayPostOp: DAY_POST_OP,
    symptoms: symptomsFor(scenario),
    vitals: scenarioVitals(scenario, new Date()),
    ecg: scenarioEcg(scenario),
  });
  return composeDecision(base, findings);
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PatientPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const activeScenario = await loadActiveScenario();
  const scenario = resolveFamilyScenario(first(params.state), activeScenario);
  const decision = loadDecision(scenario);
  const copy = patientCopy(decision);

  return (
    <PatientPortal
      patientName={PATIENT_NAME}
      dayPostOp={DAY_POST_OP}
      procedure={PROCEDURE}
      level={decision.level}
      headline={copy.headline}
      lede={copy.lede}
    />
  );
}
