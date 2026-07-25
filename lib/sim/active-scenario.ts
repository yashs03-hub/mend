import type { Scenario } from "./fixtures";

/**
 * Active demo scenario. The console selector writes here; `/api/checkin`,
 * `/api/triage`, `/family`, and `/call` read it when no explicit query
 * param overrides (and APIs fall back to fixtures with no Supabase /
 * empty tables).
 *
 * Storage layers:
 * 1. `globalThis` — shared across Route Handler / Server Component bundles
 *    in one Node process (Turbopack/webpack otherwise fork module state).
 * 2. Supabase `demo_state` row — durable across Vercel serverless isolates
 *    when credentials + table are configured. See `demo-state.sql`.
 *
 * Sync `getActiveScenario` / `setActiveScenario` remain for in-process
 * reads/writes after hydration. Pages and API routes that need the
 * cross-instance value should `await loadActiveScenario()` before reading,
 * and `await persistActiveScenario()` when the console changes it.
 */

const GLOBAL_KEY = "__mendActiveScenario" as const;
const DEMO_STATE_KEY = "active_scenario";
const SUPABASE_TIMEOUT_MS = 800;

type MendGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: Scenario;
};

function store(): MendGlobal {
  return globalThis as MendGlobal;
}

export const SCENARIOS = ["green", "pe", "drift"] as const satisfies readonly Scenario[];

export const SCENARIO_META: Record<
  Scenario,
  { label: string; summary: string }
> = {
  green: {
    label: "Green",
    summary: "Well patient, POD 4 — nothing remarkable.",
  },
  pe: {
    label: "PE",
    summary: "Acute PE-pattern: hypoxic, tachycardic, ECG tachycardia.",
  },
  drift: {
    label: "Drift",
    summary: "In-range vitals; resting HR climbing ~3 bpm/day.",
  },
};

export function isScenario(value: unknown): value is Scenario {
  return value === "green" || value === "pe" || value === "drift";
}

export function getActiveScenario(): Scenario {
  return store()[GLOBAL_KEY] ?? "green";
}

export function setActiveScenario(scenario: Scenario): Scenario {
  store()[GLOBAL_KEY] = scenario;
  return scenario;
}

function supabaseRestConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return { url, key };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  try {
    return await Promise.race([
      work,
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } catch {
    return undefined;
  }
}

/**
 * Reads the durable scenario from Supabase `demo_state`, if configured.
 * Never throws. Returns null when unconfigured, timed out, or the table /
 * row is missing — callers keep the in-process value.
 */
async function readDurableScenario(): Promise<Scenario | null> {
  const config = supabaseRestConfig();
  if (!config) {
    return null;
  }

  const result = await withTimeout(
    (async () => {
      const res = await fetch(
        `${config.url}/rest/v1/demo_state?key=eq.${encodeURIComponent(DEMO_STATE_KEY)}&select=value`,
        {
          method: "GET",
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        console.warn(
          `[sim] demo_state read failed (HTTP ${res.status}) — using in-process scenario. ` +
            "Ensure lib/sim/demo-state.sql has been applied.",
        );
        return null;
      }
      const rows = (await res.json()) as Array<{ value?: unknown }>;
      const value = rows[0]?.value;
      return isScenario(value) ? value : null;
    })(),
    SUPABASE_TIMEOUT_MS,
  );

  return result ?? null;
}

/**
 * Upserts the durable scenario. Returns true when Supabase acknowledged the
 * write; false when unconfigured, timed out, or the table is missing.
 */
async function writeDurableScenario(scenario: Scenario): Promise<boolean> {
  const config = supabaseRestConfig();
  if (!config) {
    return false;
  }

  const result = await withTimeout(
    (async () => {
      const res = await fetch(`${config.url}/rest/v1/demo_state`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          key: DEMO_STATE_KEY,
          value: scenario,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        console.warn(
          `[sim] demo_state write failed (HTTP ${res.status}) — in-process only. ` +
            "Ensure lib/sim/demo-state.sql has been applied.",
        );
        return false;
      }
      return true;
    })(),
    SUPABASE_TIMEOUT_MS,
  );

  return result === true;
}

/**
 * Hydrate the in-process store from Supabase when available, then return
 * the active scenario. Pages and API routes that need the durable value
 * should call this (rather than sync `getActiveScenario()` alone).
 */
export async function loadActiveScenario(): Promise<Scenario> {
  const remote = await readDurableScenario();
  if (remote) {
    return setActiveScenario(remote);
  }
  return getActiveScenario();
}

/**
 * Set the active scenario in-process and, when Supabase is configured,
 * persist it so other serverless isolates see the same selection.
 */
export async function persistActiveScenario(scenario: Scenario): Promise<Scenario> {
  setActiveScenario(scenario);
  // Best-effort durable write. Failures are logged inside writeDurableScenario;
  // unconfigured Supabase is intentional for local/dev (in-process only).
  await writeDurableScenario(scenario);
  return scenario;
}
