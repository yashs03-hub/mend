import { describe, expect, it } from "vitest";
import { DEFAULT_PATIENT_FIRST_NAME, firstName, scriptForDecision } from "./scripts";
import type { Decision } from "./types";

function decision(partial: Partial<Decision> = {}): Decision {
  return {
    level: "green",
    action: "Continue the current recovery plan.",
    rationale: ["Everything is within the expected range."],
    firedRules: [],
    ...partial,
  };
}

describe("firstName", () => {
  it("strips the demo/synthetic parenthetical from the stored display name", () => {
    expect(firstName("Margaret (demo, synthetic)")).toBe("Margaret");
  });

  it("returns a plain single-word name unchanged", () => {
    expect(firstName("Margaret")).toBe("Margaret");
  });

  it("takes only the first word of a multi-word name with no parenthetical", () => {
    expect(firstName("Margaret Smith")).toBe("Margaret");
  });

  it("falls back to the default demo name for an empty string", () => {
    expect(firstName("   ")).toBe(DEFAULT_PATIENT_FIRST_NAME);
  });
});

describe("scriptForDecision — red", () => {
  it("is short, plain-language, and instructs 911 for a 911 call", () => {
    const script = scriptForDecision(
      decision({
        level: "red",
        condition: "Suspected pulmonary embolism",
        call: "911",
        action: "Call 911 now.",
      }),
    );

    expect(script).toContain("911");
    expect(script).toContain("Margaret");
    expect(script.toLowerCase()).not.toContain("pulmonary embolism");
    expect(script.toLowerCase()).not.toContain("hypoxia");
  });

  it("uses the supplied patient first name, not the default", () => {
    const script = scriptForDecision(
      decision({ level: "red", condition: "Hypoxia", call: "911" }),
      "Harold",
    );
    expect(script).toContain("Harold");
    expect(script).not.toContain("Margaret");
  });

  it("says go to the emergency room, not call 911, when call is ER", () => {
    const script = scriptForDecision(
      decision({ level: "red", condition: "Possible sepsis", call: "ER" }),
    );
    expect(script.toLowerCase()).toContain("emergency room");
  });

  it("falls back to a safe generic reason for an unmapped condition", () => {
    const script = scriptForDecision(
      decision({ level: "red", condition: "Some future red rule", call: "911" }),
    );
    expect(script).toContain("911");
    expect(script.length).toBeGreaterThan(0);
  });

  it("every mapped red condition produces a script containing 911 and the action stated first", () => {
    const conditions = [
      "Suspected pulmonary embolism",
      "Hypoxia",
      "Suspected shock / bleeding",
      "Suspected hip dislocation",
      "Possible sepsis",
    ];
    for (const condition of conditions) {
      const script = scriptForDecision(decision({ level: "red", condition, call: "911" }));
      expect(script).toContain("911");
      // Action-first: the imperative to call 911 appears before any
      // clinical explanation sentence.
      expect(script.indexOf("call 911")).toBeLessThan(script.indexOf(". "));
    }
  });
});

describe("scriptForDecision — amber", () => {
  it("names the surgeon's office for a surgeon_office call, never 911", () => {
    const script = scriptForDecision(
      decision({ level: "amber", condition: "Possible DVT", call: "surgeon_office" }),
    );
    expect(script.toLowerCase()).toContain("surgeon");
    expect(script).not.toContain("911");
  });

  it("names the nurse line for a nurse_line call", () => {
    const script = scriptForDecision(
      decision({ level: "amber", condition: "New confusion", call: "nurse_line" }),
    );
    expect(script.toLowerCase()).toContain("nurse line");
  });

  it("reassures the patient this is not an emergency", () => {
    const script = scriptForDecision(
      decision({ level: "amber", condition: "Uncontrolled pain", call: "nurse_line" }),
    );
    expect(script.toLowerCase()).toContain("not an emergency");
  });

  it("falls back to a safe generic reason and contact phrase for an unmapped amber condition", () => {
    const script = scriptForDecision(decision({ level: "amber", condition: "Something new" }));
    expect(script.length).toBeGreaterThan(0);
    expect(script).not.toContain("911");
  });
});

describe("scriptForDecision — green", () => {
  it("is reassuring and mentions no escalation", () => {
    const script = scriptForDecision(decision({ level: "green" }));
    expect(script.toLowerCase()).toContain("everything looks good");
    expect(script).not.toContain("911");
    expect(script.toLowerCase()).not.toContain("emergency");
  });
});

describe("scriptForDecision — purity", () => {
  it("is deterministic: identical input always yields identical output", () => {
    const d = decision({ level: "red", condition: "Hypoxia", call: "911" });
    expect(scriptForDecision(d)).toBe(scriptForDecision(d));
    expect(scriptForDecision(d)).toBe(scriptForDecision(decision({ level: "red", condition: "Hypoxia", call: "911" })));
  });
});
