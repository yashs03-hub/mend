import type { Scenario } from "./fixtures";

/**
 * Resolves which demo scenario drives a product surface.
 *
 * Explicit query params always win — `scripts/visual-check.mjs` and deep
 * links freeze `/family?state=attention`, `/family?state=urgent`, and
 * `/call?stage=escalated` — then the console's active-scenario store, then
 * green.
 *
 * Family's `state` vocabulary (well / attention / urgent) is not the same
 * as the store's scenario vocabulary (green / pe / drift). `attention` maps
 * to drift (amber HR creep); `urgent` maps to pe (embolism cut). Never use
 * `attention` for the PE family frame — severity still comes from
 * `composeDecision` over the trend engine, never from a hard-coded chip.
 */

/** Mirrors `CallStage` in app/components/call/timeline.ts — kept here so
 * lib/ does not import from app/. */
export type DemoCallStage = "monitoring" | "checking" | "escalated";

function parseDemoCallStage(raw: string | undefined): DemoCallStage | undefined {
  return raw === "monitoring" || raw === "checking" || raw === "escalated"
    ? raw
    : undefined;
}

export function resolveFamilyScenario(
  stateParam: string | undefined,
  activeScenario: Scenario,
): Scenario {
  if (stateParam === "urgent") return "pe";
  if (stateParam === "attention") return "drift";
  if (stateParam === "well") return "green";
  return activeScenario;
}

/**
 * Named call-stage freeze frames. An explicit `?stage=` wins; otherwise the
 * active scenario picks the presenter's default frame (PE → escalated red
 * takeover; green/drift → calm monitoring). Returns `undefined` only when
 * the caller is in playback mode and must start at cursor 0.
 */
export function resolveCallStage(
  stageParam: string | undefined,
  activeScenario: Scenario,
  opts: { playing: boolean } = { playing: false },
): DemoCallStage | undefined {
  const explicit = parseDemoCallStage(stageParam);
  if (explicit !== undefined) return explicit;
  if (opts.playing) return undefined;
  return activeScenario === "pe" ? "escalated" : "monitoring";
}
