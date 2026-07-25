import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VIGNETTES, runVignettes, type Vignette } from "./vignettes";

/**
 * These tests do NOT assert that every vignette passes. `red-flag-engine.ts`
 * is DO-NOT-MODIFY and its own test file is the gate on the engine's
 * behaviour; duplicating that assertion here would mean a regression stopped
 * `public/vignettes.json` from being regenerated at all, which is the one
 * moment the engine page most needs to be truthful.
 *
 * What is tested instead is that the exported result is honest: that `pass`
 * is derived from a real comparison rather than baked in, that every rule id
 * the table expects is one the engine can actually emit, and that the shape
 * the page consumes is the shape that is written.
 */

function engineRuleIds(): Set<string> {
  const source = readFileSync(new URL("./red-flag-engine.ts", import.meta.url), "utf8");
  return new Set([...source.matchAll(/\bid:\s*"([^"]+)"|"([a-z0-9_]+\.[a-z0-9_]+)"/g)].map((m) => m[1] ?? m[2]));
}

describe("the vignette table", () => {
  it("has unique names and covers both the binding table and the safety edges", () => {
    expect(new Set(VIGNETTES.map((v) => v.name)).size).toBe(VIGNETTES.length);
    expect(new Set(VIGNETTES.map((v) => v.group))).toEqual(
      new Set(["Binding vignette table", "Safety edges and threshold boundaries"]),
    );
  });

  it("carries the fifteen binding cases from task-4-brief plus the ECG-only variant", () => {
    const table = VIGNETTES.filter((v) => v.group === "Binding vignette table");
    expect(table.map((v) => v.name)).toEqual([
      "1", "2", "3", "4", "5", "5b", "6", "7", "8",
      "9", "10", "11", "12", "13", "14", "15",
    ]);
  });

  it("only ever expects rule ids the engine can actually emit", () => {
    const known = engineRuleIds();
    for (const vignette of VIGNETTES) {
      for (const id of vignette.expected.firedRules ?? []) {
        expect(known.has(id), `${vignette.name} expects unknown rule ${id}`).toBe(true);
      }
    }
  });

  it("explains every case, so the engine page is readable without the source", () => {
    for (const vignette of VIGNETTES) {
      expect(vignette.note.length, vignette.name).toBeGreaterThan(20);
    }
  });
});

describe("runVignettes", () => {
  const results = runVignettes();

  it("returns one result per vignette, in table order", () => {
    expect(results.map((r) => r.name)).toEqual(VIGNETTES.map((v) => v.name));
  });

  it("records what the engine actually returned, not what was expected", () => {
    for (const result of results) {
      expect(result.actual.action.length, result.name).toBeGreaterThan(0);
      expect(result.actual.rationale.length, result.name).toBeGreaterThan(0);
      expect(Array.isArray(result.actual.firedRules)).toBe(true);
    }
  });

  it("derives pass from a real comparison — a wrong expectation fails and says why", () => {
    const sabotaged: Vignette = {
      ...VIGNETTES[0],
      name: "sabotage",
      expected: { level: "red", condition: "Something that never happens" },
    };

    const [result] = runVignettes([sabotaged]);
    expect(result.pass).toBe(false);
    expect(result.mismatches.join(" ")).toContain("expected level red");
    expect(result.mismatches.join(" ")).toContain("Something that never happens");
    // The recorded actual is still the engine's, untouched by the bad guess.
    expect(result.actual.level).toBe("green");
  });

  it("reports a passing case with no mismatches", () => {
    const [result] = runVignettes([VIGNETTES[0]]);
    expect(result.mismatches).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("serialises to JSON without losing a field the engine page reads", () => {
    const round = JSON.parse(JSON.stringify(runVignettes([VIGNETTES[3]])))[0];
    expect(round).toMatchObject({
      name: "4",
      day: 4,
      pass: true,
    });
    expect(round.vitals.hr).toBe(122);
    expect(round.expected.level).toBe("red");
    // Both corroborators fire: HR 122 is tachycardic and SpO2 91% sits below the
    // phase floor. Naming each one separately is the point — a clinician reading
    // the handoff should see that two independent findings agreed, not one.
    expect(round.actual.firedRules).toEqual([
      "pe.breathless_with_tachycardia",
      "pe.breathless_with_low_spo2",
    ]);
  });
});
