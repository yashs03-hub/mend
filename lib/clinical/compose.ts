import type { Decision, TrendFinding } from "./types";

/**
 * Composes `evaluate()`'s single-reading Decision with `evaluateTrends()`'s
 * trajectory findings into the final Decision for a check-in.
 *
 * THE COMPOSITION RULE (binding): `evaluate()` owns the level.
 *   - Trend findings may RAISE a "green" Decision to "amber".
 *   - Trend findings may NEVER lower any level.
 *   - Trend findings may NEVER raise "amber" to "red".
 *
 * This is enforced structurally, not by a severity comparison: the only
 * branch in this function that produces a new Decision is the
 * green-with-findings branch. Every other input — amber, red, or green
 * with no findings — returns `decision` completely untouched. There is no
 * code path anywhere in this function that reads, reweighs, or rewrites an
 * amber or red verdict, so a trend finding cannot dilute, second-guess, or
 * override an escalation the deterministic engine already made. `evaluate()`
 * (red-flag-engine.ts) is DO-NOT-MODIFY and remains the sole owner of every
 * severity verdict; this function only ever adds a green->amber edge on
 * top of it.
 */
export const TREND_ESCALATION_RULE_ID = "trend.raised_green_to_amber";

const TREND_ESCALATION_ACTION =
  "Contact the nurse line today — a gradual change in your readings needs a closer look.";

const METRIC_LABELS: Readonly<Record<TrendFinding["metric"], string>> = {
  hr: "heart rate",
  spo2: "oxygen saturation",
  tempC: "temperature",
  painScore: "pain score",
};

function trendCondition(findings: readonly TrendFinding[]): string {
  const metrics = [...new Set(findings.map((f) => METRIC_LABELS[f.metric]))];
  return `Gradual change in ${metrics.join(" and ")}`;
}

export function composeDecision(decision: Decision, trendFindings: TrendFinding[]): Decision {
  if (decision.level !== "green" || trendFindings.length === 0) {
    return decision;
  }

  return {
    level: "amber",
    condition: trendCondition(trendFindings),
    action: TREND_ESCALATION_ACTION,
    call: "nurse_line",
    rationale: [...decision.rationale, ...trendFindings.map((f) => f.description)],
    firedRules: [...decision.firedRules, TREND_ESCALATION_RULE_ID],
  };
}
