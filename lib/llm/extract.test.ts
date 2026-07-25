import { describe, it, expect } from "vitest";
import { extractSymptomsHeuristic } from "./extract";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { scenarioVitals } from "@/lib/sim/vitals-feed";

/**
 * The heuristic path is the one that runs with no API key and no network, so it
 * is the path most likely to be exercised on hackathon wifi. It is deterministic,
 * so it gets the same test treatment as the clinical core.
 */
describe("extractSymptomsHeuristic", () => {
  it("catches breathlessness in a patient's own words", () => {
    expect(extractSymptomsHeuristic("I'm a bit out of puff, love").breathless).toBe(true);
    expect(extractSymptomsHeuristic("I feel short of breath").breathless).toBe(true);
  });

  it("catches the demo red-path transcript end to end", () => {
    const s = extractSymptomsHeuristic(
      "I'm a bit out of puff. There's a sharp catch in my chest when I breathe deep. My right calf's been sore and swollen too.",
    );
    expect(s.breathless).toBe(true);
    expect(s.chestPain).toBe(true);
    expect(s.calfPainOrSwelling).toBe(true);

    const d = evaluate({
      dayPostOp: 9,
      symptoms: s,
      vitals: scenarioVitals("pe", "t"),
    });
    expect(d.level).toBe("red");
    expect(d.call).toBe("911");
  });

  it("leaves a well patient's transcript clean", () => {
    const s = extractSymptomsHeuristic(
      "Slept alright, thank you. It's a bit sore but manageable. I did my walk to the kitchen with the frame.",
    );
    expect(s.breathless).toBeUndefined();
    expect(s.chestPain).toBeUndefined();
    expect(s.calfPainOrSwelling).toBeUndefined();
    expect(s.painControlled).toBe(true);

    const d = evaluate({
      dayPostOp: 4,
      symptoms: s,
      vitals: scenarioVitals("green", "t"),
    });
    expect(d.level).toBe("green");
  });

  it("distinguishes controlled from uncontrolled pain", () => {
    expect(extractSymptomsHeuristic("the pain is bad today").painControlled).toBe(false);
    expect(extractSymptomsHeuristic("pain is fine").painControlled).toBe(true);
    expect(extractSymptomsHeuristic("I watched the telly").painControlled).toBeUndefined();
  });

  it("returns an empty object rather than throwing on junk input", () => {
    expect(extractSymptomsHeuristic("")).toEqual({});
    expect(extractSymptomsHeuristic("...")).toEqual({});
  });
});
