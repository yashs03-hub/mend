import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { evaluate } from "../clinical/red-flag-engine";
import type { VitalsReading } from "../clinical/types";
import { extractSymptoms } from "./extract";
import { fixtureMessage, fixtureToolUseBlock } from "./test-fixtures";

/**
 * End-to-end safety contract for Fix 1: extractSymptoms result shape must
 * drive evaluate()'s symptomsUnusable flag so failure never greens and a
 * genuine empty report still can.
 */
const unremarkableVitals: VitalsReading = {
  timestamp: "2026-07-25T12:00:00.000Z",
  source: "manual",
  quality: "ok",
  hr: 76,
  spo2: 97,
  tempC: 36.9,
  sbp: 122,
  dbp: 78,
};

describe("extractSymptoms + evaluate fail-safe (both directions)", () => {
  it("scary transcript with extraction unavailable does NOT return green", async () => {
    const extraction = await extractSymptoms(
      "I can't breathe and my chest hurts.",
      { client: null },
    );
    expect(extraction.ok).toBe(false);

    const decision = evaluate({
      dayPostOp: 4,
      symptoms: extraction.symptoms,
      vitals: unremarkableVitals,
      symptomsUnusable: !extraction.ok,
    });

    expect(decision.level).not.toBe("green");
    expect(decision.firedRules).toContain("symptoms.extraction_failed");
  });

  it("genuinely unremarkable check-in with extraction working DOES still return green", async () => {
    const fakeClient = {
      messages: {
        create: async () =>
          fixtureMessage([
            fixtureToolUseBlock("report_symptoms", { painControlled: true }),
          ]),
      },
    } as unknown as Anthropic;

    const extraction = await extractSymptoms(
      "I'm doing fine, pain is controlled, nothing unusual.",
      { client: fakeClient },
    );
    expect(extraction.ok).toBe(true);
    expect(extraction.symptoms).toEqual({ painControlled: true });

    const decision = evaluate({
      dayPostOp: 4,
      symptoms: extraction.symptoms,
      vitals: unremarkableVitals,
      symptomsUnusable: !extraction.ok,
    });

    expect(decision.level).toBe("green");
    expect(decision.firedRules).toEqual([]);
  });
});
