import { NextResponse } from "next/server";
import {
  isScenario,
  loadActiveScenario,
  persistActiveScenario,
  SCENARIO_META,
} from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "@/lib/sim/fixtures";

/**
 * GET/POST /api/scenario — the demo console's scenario selector.
 *
 * Selecting a scenario makes it the active fixture fallback that
 * `/api/checkin` and `/api/triage` read when Supabase has no rows.
 * Persist goes to Supabase `demo_state` when configured so other
 * serverless isolates see the same selection; otherwise in-process only.
 * Never throws; malformed bodies get 400.
 */

export async function GET(): Promise<NextResponse> {
  const scenario = await loadActiveScenario();
  return NextResponse.json({
    scenario,
    meta: SCENARIO_META[scenario],
    vitals: scenarioVitals(scenario, new Date()),
    ecg: scenarioEcg(scenario),
    historyDays: scenarioHistory(scenario).length,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const scenario =
    typeof raw === "object" && raw !== null && "scenario" in raw
      ? (raw as { scenario: unknown }).scenario
      : undefined;

  if (!isScenario(scenario)) {
    return NextResponse.json(
      { error: 'Expected { scenario: "green" | "pe" | "drift" }.' },
      { status: 400 },
    );
  }

  await persistActiveScenario(scenario);
  const now = new Date();

  return NextResponse.json({
    scenario,
    meta: SCENARIO_META[scenario],
    vitals: scenarioVitals(scenario, now),
    ecg: scenarioEcg(scenario),
    historyDays: scenarioHistory(scenario).length,
  });
}
