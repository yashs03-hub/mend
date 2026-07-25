import { describe, it, expect } from "vitest";
import { generateExtractionCorpus, generateVignettes, rng } from "./generate";
import { extractSymptomsHeuristic } from "@/lib/llm/extract";

describe("generator determinism", () => {
  it("same seed produces an identical corpus", () => {
    expect(generateExtractionCorpus(50, 42)).toEqual(
      generateExtractionCorpus(50, 42),
    );
    expect(generateVignettes(50, 42)).toEqual(generateVignettes(50, 42));
  });

  it("different seeds produce different corpora", () => {
    expect(generateExtractionCorpus(50, 1)).not.toEqual(
      generateExtractionCorpus(50, 2),
    );
  });

  it("rng is stable across calls with the same seed", () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
});

/**
 * Negation regression suite.
 *
 * The synthetic corpus found the offline extractor raising 470 false positives
 * across 533 transcripts containing an explicit denial — "no chest pain at all"
 * scored as chest pain. On the no-API-key path that escalates a well patient to
 * red, which is the fastest way to lose a clinician's trust. These cases pin
 * that shut.
 */
describe("extractor does not invert denials", () => {
  const denials: [string, string][] = [
    ["no chest pain at all, thankfully", "chestPain"],
    ["I've had no chest pain since the operation", "chestPain"],
    ["I'm not breathless, my breathing's been fine", "breathless"],
    ["no shortness of breath to speak of", "breathless"],
    ["no calf pain or swelling that I can see", "calfPainOrSwelling"],
    ["my calf is fine, no swelling", "calfPainOrSwelling"],
    ["there's no discharge from the wound, it's dry", "woundDischarge"],
    ["I haven't had any fever or chills", "feverSubjective"],
    ["no confusion, I'm sharp as ever", "newConfusion"],
    ["I can still put weight on it, no trouble", "unableToWeightBear"],
  ];

  for (const [text, field] of denials) {
    it(`"${text}" does not set ${field}`, () => {
      expect(extractSymptomsHeuristic(text)[field as "chestPain"]).toBeUndefined();
    });
  }

  it("suppresses a denial without suppressing a real symptom beside it", () => {
    const s = extractSymptomsHeuristic(
      "No chest pain at all. But my right calf has been sore and swollen.",
    );
    expect(s.chestPain).toBeUndefined();
    expect(s.calfPainOrSwelling).toBe(true);
  });

  it("does not treat reported advice as a symptom", () => {
    expect(
      extractSymptomsHeuristic(
        "The physiotherapist mentioned watching out for calf pain.",
      ).calfPainOrSwelling,
    ).toBeUndefined();
    expect(
      extractSymptomsHeuristic(
        "The nurse asked about breathlessness when she rang.",
      ).breathless,
    ).toBeUndefined();
  });

  it("still reads inability, which is phrased using negatives", () => {
    expect(extractSymptomsHeuristic("I can't put any weight on it at all").unableToWeightBear).toBe(true);
    expect(extractSymptomsHeuristic("I can't stand on that leg this morning").unableToWeightBear).toBe(true);
  });
});
