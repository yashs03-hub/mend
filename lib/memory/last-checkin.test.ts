import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckinRow } from "../db/supabase";
import {
  formatFamilyRecall,
  formatLastCheckinSummary,
  rowToLastCheckinFacts,
  type LastCheckinFacts,
} from "./last-checkin";

function checkinRow(partial: Partial<CheckinRow> = {}): CheckinRow {
  return {
    id: "checkin-1",
    patient_id: "patient-1",
    created_at: "2026-07-24T09:00:00.000Z",
    day_post_op: 4,
    transcript: "I'm doing ok.",
    symptoms: {},
    vitals: null,
    decision: { level: "green" },
    trend_findings: [],
    sbar: null,
    ...partial,
  };
}

function facts(partial: Partial<LastCheckinFacts> = {}): LastCheckinFacts {
  return {
    createdAt: "2026-07-24T09:00:00.000Z",
    symptoms: {},
    decisionLevel: undefined,
    ...partial,
  };
}

const NOW = new Date("2026-07-25T13:00:00.000Z");

describe("formatLastCheckinSummary (pure)", () => {
  it("returns an empty string when there is no prior check-in", () => {
    expect(formatLastCheckinSummary(undefined, NOW)).toBe("");
  });

  it("produces the pain-score + breathlessness sentence, matching the brief's worked example", () => {
    const summary = formatLastCheckinSummary(
      facts({ symptoms: { painScore: 7, breathless: false } }),
      NOW,
    );
    expect(summary).toBe("Yesterday you rated your pain 7 out of 10 and reported no breathlessness.");
  });

  it("reports feeling breathless when true", () => {
    const summary = formatLastCheckinSummary(facts({ symptoms: { breathless: true } }), NOW);
    expect(summary).toContain("reported feeling breathless");
  });

  it("says 'Earlier today' for a same-day check-in", () => {
    const summary = formatLastCheckinSummary(
      facts({ createdAt: "2026-07-25T08:00:00.000Z", symptoms: { painScore: 3 } }),
      NOW,
    );
    expect(summary.startsWith("Earlier today")).toBe(true);
  });

  it("says 'N days ago' for an older check-in", () => {
    const summary = formatLastCheckinSummary(
      facts({ createdAt: "2026-07-20T08:00:00.000Z", symptoms: { painScore: 3 } }),
      NOW,
    );
    expect(summary.startsWith("5 days ago")).toBe(true);
  });

  it("falls back to a decision-level statement when no notable symptoms were recorded", () => {
    const green = formatLastCheckinSummary(facts({ decisionLevel: "green" }), NOW);
    expect(green).toContain("said everything looked fine");

    const amber = formatLastCheckinSummary(facts({ decisionLevel: "amber" }), NOW);
    expect(amber).toContain("flagged some concerns");
  });

  it("returns an empty string for a facts object with nothing worth recalling", () => {
    expect(formatLastCheckinSummary(facts({ symptoms: {}, decisionLevel: undefined }), NOW)).toBe("");
  });

  it("joins three or more clauses with a final 'and'", () => {
    const summary = formatLastCheckinSummary(
      facts({ symptoms: { painScore: 6, chestPain: true, woundDischarge: true } }),
      NOW,
    );
    expect(summary).toBe(
      "Yesterday you rated your pain 6 out of 10, reported chest pain and reported wound discharge.",
    );
  });
});

describe("formatFamilyRecall (pure, third person)", () => {
  it("returns an empty string when there is no prior check-in", () => {
    expect(formatFamilyRecall(undefined, NOW)).toBe("");
  });

  it("returns an empty string when facts carry nothing worth recalling", () => {
    expect(formatFamilyRecall(facts({ symptoms: {}, decisionLevel: undefined }), NOW)).toBe("");
  });

  it("speaks in the third person about Mum, without vitals numbers", () => {
    const summary = formatFamilyRecall(
      facts({ symptoms: { painScore: 4, breathless: false } }),
      NOW,
    );
    expect(summary).toBe(
      "Yesterday she rated her pain 4 out of 10 and reported no breathlessness.",
    );
    expect(summary).not.toMatch(/\b(bpm|SpO2|mmHg|°C)\b/i);
  });

  it("falls back to a decision-level statement when no notable symptoms were recorded", () => {
    expect(formatFamilyRecall(facts({ decisionLevel: "amber" }), NOW)).toContain(
      "flagged some concerns",
    );
  });
});

describe("rowToLastCheckinFacts (pure narrowing of a jsonb row)", () => {
  it("extracts symptoms and decision level from a well-formed row", () => {
    const row = checkinRow({
      symptoms: { painScore: 8, breathless: true },
      decision: { level: "red", condition: "Suspected pulmonary embolism" },
    });
    const result = rowToLastCheckinFacts(row);
    expect(result.symptoms).toEqual({ painScore: 8, breathless: true });
    expect(result.decisionLevel).toBe("red");
    expect(result.createdAt).toBe(row.created_at);
  });

  it("never throws on malformed jsonb columns", () => {
    const row = checkinRow({ symptoms: "not an object", decision: 42 });
    expect(() => rowToLastCheckinFacts(row)).not.toThrow();
    const result = rowToLastCheckinFacts(row);
    expect(result.symptoms).toEqual({});
    expect(result.decisionLevel).toBeUndefined();
  });

  it("ignores an unrecognized decision level string", () => {
    const row = checkinRow({ decision: { level: "purple" } });
    expect(rowToLastCheckinFacts(row).decisionLevel).toBeUndefined();
  });
});

describe("lastCheckinSummary (impure DB read)", () => {
  afterEach(() => {
    vi.doUnmock("../db/supabase");
    vi.doUnmock("../db/queries");
    vi.resetModules();
  });

  it("returns '' and warns, without throwing, when Supabase is unavailable", async () => {
    vi.resetModules();
    vi.doMock("../db/supabase", () => ({ getSupabaseClient: () => null }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lastCheckinSummary } = await import("./last-checkin");
    const result = await lastCheckinSummary("patient-1");

    expect(result).toBe("");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Supabase client unavailable"));
    warn.mockRestore();
  });

  it("returns '' when there is no prior check-in row", async () => {
    vi.resetModules();
    vi.doMock("../db/supabase", () => ({ getSupabaseClient: () => ({}) }));
    vi.doMock("../db/queries", () => ({ fetchLatestCheckin: async () => undefined }));

    const { lastCheckinSummary } = await import("./last-checkin");
    expect(await lastCheckinSummary("patient-1")).toBe("");
  });

  it("formats the fetched row into the recall sentence", async () => {
    vi.resetModules();
    vi.doMock("../db/supabase", () => ({ getSupabaseClient: () => ({}) }));
    vi.doMock("../db/queries", () => ({
      fetchLatestCheckin: async () =>
        checkinRow({ created_at: NOW.toISOString(), symptoms: { painScore: 5 } }),
    }));

    const { lastCheckinSummary } = await import("./last-checkin");
    const result = await lastCheckinSummary("patient-1");
    expect(result).toContain("rated your pain 5 out of 10");
  });

  it("returns '' and warns, without throwing, when the read rejects", async () => {
    vi.resetModules();
    vi.doMock("../db/supabase", () => ({ getSupabaseClient: () => ({}) }));
    vi.doMock("../db/queries", () => ({
      fetchLatestCheckin: async () => {
        throw new Error("connection reset");
      },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lastCheckinSummary } = await import("./last-checkin");
    await expect(lastCheckinSummary("patient-1")).resolves.toBe("");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("failed to load the last check-in"), expect.anything());
    warn.mockRestore();
  });
});
