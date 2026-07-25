import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

async function freshSupabaseModule() {
  vi.resetModules();
  return import("./supabase");
}

describe("getSupabaseClient", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    vi.unstubAllEnvs();
  });

  it("returns null and warns, never throws, when no env vars are set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getSupabaseClient } = await freshSupabaseModule();

    expect(() => getSupabaseClient()).not.toThrow();
    expect(getSupabaseClient()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("persistence is disabled"));

    warn.mockRestore();
  });

  it("returns a client when the service-role key is present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { getSupabaseClient } = await freshSupabaseModule();
    expect(getSupabaseClient()).not.toBeNull();
  });

  it("falls back to the anon key when no service-role key is present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { getSupabaseClient } = await freshSupabaseModule();
    expect(getSupabaseClient()).not.toBeNull();
  });

  it("prefers the service-role key over the anon key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { getSupabaseClient } = await freshSupabaseModule();
    const client = getSupabaseClient();
    expect(client).not.toBeNull();
    // `supabaseKey` is a protected field at the type level but a plain
    // runtime property; reading it is the most direct way to prove which
    // key actually won without depending on network behavior.
    const key = (client as unknown as { supabaseKey: string }).supabaseKey;
    expect(key).toBe("service-role-key");
  });

  it("caches the client across calls within the same module instance", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { getSupabaseClient } = await freshSupabaseModule();
    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });
});

describe("schema.sql", () => {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");

  it("declares every table the brief requires with its exact name", () => {
    for (const table of [
      "patients",
      "vitals",
      "ecg_readings",
      "checkins",
      "escalations",
      "demo_state",
    ]) {
      expect(sql).toMatch(new RegExp(`create table if not exists ${table}\\b`));
    }
  });

  it("declares every column the brief requires on each table", () => {
    const expectedColumns: Record<string, string[]> = {
      patients: ["id", "name", "procedure", "surgery_date", "phone", "caregiver_phone"],
      vitals: [
        "id",
        "patient_id",
        "recorded_at",
        "hr",
        "sbp",
        "dbp",
        "temp_c",
        "spo2",
        "resp_rate",
        "source",
        "device_label",
        "quality",
      ],
      ecg_readings: ["id", "patient_id", "recorded_at", "determination", "bpm", "source", "pdf_url"],
      checkins: [
        "id",
        "patient_id",
        "created_at",
        "day_post_op",
        "transcript",
        "symptoms",
        "vitals",
        "decision",
        "trend_findings",
        "sbar",
      ],
      escalations: ["id", "patient_id", "checkin_id", "level", "condition", "notified_caregiver_at"],
    };

    for (const [table, columns] of Object.entries(expectedColumns)) {
      const tableMatch = sql.match(
        new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\);`),
      );
      expect(tableMatch, `table ${table} not found`).not.toBeNull();
      const body = tableMatch![1];
      for (const column of columns) {
        expect(body, `${table}.${column} missing`).toMatch(new RegExp(`\\b${column}\\b`));
      }
    }
  });

  it("indexes vitals by (patient_id, recorded_at) for the trend engine's time-series reads", () => {
    expect(sql).toMatch(/create index if not exists vitals_patient_id_recorded_at_idx\s+on vitals \(patient_id, recorded_at desc\)/);
  });

  it("notes RLS is intentionally off and disables it on every table", () => {
    expect(sql.toLowerCase()).toContain("rls is intentionally left off");
    const disableCount = (sql.match(/disable row level security/g) ?? []).length;
    // patients, vitals, ecg_readings, checkins, escalations, demo_state
    expect(disableCount).toBe(6);
  });

  it("seeds the synthetic demo patient with the exact required values", () => {
    expect(sql).toContain("'Margaret (demo, synthetic)'");
    expect(sql).toContain("'hip hemiarthroplasty'");
    expect(sql).toContain("current_date - 4");
  });
});
