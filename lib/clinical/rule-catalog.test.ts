import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TREND_ESCALATION_RULE_ID } from "./compose";
import { RULE_CATALOG, auditRule, ruleEntry } from "./rule-catalog";

/**
 * The catalogue is a mirror of rules defined elsewhere, so the thing worth
 * testing is that the mirror is complete. These tests read the rule ids out
 * of the source files rather than out of any exported constant: the engine is
 * DO-NOT-MODIFY and exports no rule list, and a hand-maintained list would
 * just be a second thing to forget to update.
 */

function idsIn(file: string, prefixFilter?: (id: string) => boolean): string[] {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const ids = [...source.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(prefixFilter ? ids.filter(prefixFilter) : ids)].sort();
}

describe("rule catalogue covers every rule id the product can emit", () => {
  it("matches the red-flag engine's rule ids exactly", () => {
    const engineIds = idsIn("./red-flag-engine.ts");
    const catalogued = RULE_CATALOG.filter((r) => r.origin === "red-flag-engine")
      .map((r) => r.id)
      .sort();

    expect(engineIds.length).toBeGreaterThan(0);
    expect(catalogued).toEqual(engineIds);
  });

  it("matches the trend engine's finding ids, plus the compose edge", () => {
    const trendIds = idsIn("./trends.ts", (id) => id.startsWith("trend."));
    const catalogued = RULE_CATALOG.filter((r) => r.origin === "trend-engine")
      .map((r) => r.id)
      .sort();

    expect(trendIds.length).toBeGreaterThan(0);
    expect(catalogued).toEqual([...trendIds, TREND_ESCALATION_RULE_ID].sort());
  });

  it("every entry names a condition and describes what it tests", () => {
    for (const entry of RULE_CATALOG) {
      expect(entry.condition.length, entry.id).toBeGreaterThan(0);
      expect(entry.test.length, entry.id).toBeGreaterThan(0);
    }
  });
});

describe("auditRule resolves provenance against the real phase envelope", () => {
  const ctx = {
    dayPostOp: 4,
    symptoms: { breathless: true },
    vitals: {
      timestamp: "2026-07-25T12:00:00.000Z",
      source: "manual" as const,
      quality: "ok" as const,
      hr: 122,
    },
  };

  it("cites the same tachycardia threshold the engine computed", () => {
    const audit = auditRule("pe.breathless_with_tachycardia", ctx);
    // Day 4 sits in Early protected (hrMax 100), so the threshold is 110.
    expect(audit.thresholds.map((t) => t.value)).toContain("110 bpm");
  });

  it("carries the phase envelope's own source string, not a paraphrase", () => {
    const audit = auditRule("pe.breathless_with_tachycardia", ctx);
    expect(audit.thresholds[0].source).toContain("NEWS2/AAOS");
  });

  it("marks a hard-coded threshold as hard-coded rather than borrowing the envelope's source", () => {
    const audit = auditRule("hypoxia.spo2_critical", ctx);
    expect(audit.thresholds[0].source).toContain("Hard-coded");
    expect(audit.thresholds[0].value).toBe("90%");
  });

  it("reports the values actually read, and says so when a field is absent", () => {
    const audit = auditRule("pe.breathless_with_tachycardia", ctx);
    const byPath = Object.fromEntries(audit.inputs.map((i) => [i.path, i]));

    expect(byPath["vitals.hr"].value).toBe("122 bpm");
    expect(byPath["symptoms.breathless"].value).toBe("yes");
    expect(byPath["symptoms.chestPain"].present).toBe(false);
    expect(byPath["symptoms.chestPain"].value).toBe("not reported");
  });

  it("degrades to an entry-less audit for an unknown id instead of throwing", () => {
    const audit = auditRule("not.a.real.rule", ctx);
    expect(audit.entry).toBeUndefined();
    expect(audit.inputs).toEqual([]);
    expect(ruleEntry("not.a.real.rule")).toBeUndefined();
  });
});
