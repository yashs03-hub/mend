import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  buildFactsPrompt,
  buildFallbackSbar,
  generateSbar,
  parseSbarMessage,
  type GenerateSbarArgs,
} from "./sbar";
import { fixtureMessage, fixtureTextBlock } from "./test-fixtures";
import type { Decision, EcgReading, Symptoms, TrendFinding, VitalsReading } from "../clinical/types";

function vitals(partial: Partial<VitalsReading> = {}): VitalsReading {
  return { timestamp: "2026-07-25T12:00:00.000Z", source: "manual", quality: "ok", ...partial };
}

function decision(partial: Partial<Decision> = {}): Decision {
  return {
    level: "green",
    action: "Continue the current recovery plan.",
    rationale: ["Day 5 vitals and symptoms are within the expected recovery envelope."],
    firedRules: [],
    ...partial,
  };
}

function baseArgs(partial: Partial<GenerateSbarArgs> = {}): GenerateSbarArgs {
  return {
    patient: "Margaret (demo, synthetic)",
    dayPostOp: 5,
    procedure: "hip hemiarthroplasty",
    decision: decision(),
    symptoms: {},
    vitals: vitals(),
    trendFindings: [],
    ...partial,
  };
}

describe("buildFactsPrompt", () => {
  it("includes the decision level, condition, action, and rationale verbatim", () => {
    const args = baseArgs({
      decision: decision({
        level: "amber",
        condition: "Possible DVT",
        action: "Contact the surgeon's office today.",
        call: "surgeon_office",
        rationale: ["Calf pain or swelling reported."],
      }),
    });
    const prompt = buildFactsPrompt(args);
    expect(prompt).toContain("Level: amber");
    expect(prompt).toContain("Condition: Possible DVT");
    expect(prompt).toContain("Contact the surgeon's office today.");
    expect(prompt).toContain("Calf pain or swelling reported.");
  });

  it("names the ECG source as KardiaMobile 6L when an ECG reading is present", () => {
    const ecg: EcgReading = {
      recordedAt: "2026-07-20T08:00:00.000Z",
      determination: "atrial_fibrillation",
      bpm: 130,
      source: "kardia_6l",
    };
    const prompt = buildFactsPrompt(baseArgs({ ecg }));
    expect(prompt).toContain("KardiaMobile 6L");
    expect(prompt).toContain("atrial_fibrillation");
  });

  it("omits any ECG section when no ECG reading is present", () => {
    const prompt = buildFactsPrompt(baseArgs());
    expect(prompt).not.toContain("KardiaMobile 6L");
  });

  it("includes trend findings verbatim when present", () => {
    const trendFindings: TrendFinding[] = [
      { id: "trend.hr.rising", metric: "hr", severity: "amber", description: "HR rising 3 bpm/day." },
    ];
    const prompt = buildFactsPrompt(baseArgs({ trendFindings }));
    expect(prompt).toContain("HR rising 3 bpm/day.");
  });

  it("reports only symptoms that were actually set, and 'none reported' otherwise", () => {
    const withSymptoms = buildFactsPrompt(
      baseArgs({ symptoms: { breathless: true, painScore: 4 } as Symptoms }),
    );
    expect(withSymptoms).toContain("breathless");
    expect(withSymptoms).toContain("pain score 4/10");

    const withoutSymptoms = buildFactsPrompt(baseArgs({ symptoms: {} }));
    expect(withoutSymptoms).toContain("none reported");
  });

  it("instructs Claude to use only the given facts (no inference)", () => {
    expect(buildFactsPrompt(baseArgs())).toContain("Write the SBAR now, using only the facts above.");
  });
});

describe("buildFallbackSbar (no-LLM deterministic path)", () => {
  it("states the decision level, action, and rationale verbatim without inventing anything", () => {
    const args = baseArgs({
      decision: decision({
        level: "red",
        condition: "Suspected pulmonary embolism",
        action: "Call 911 now.",
        rationale: ["Breathlessness reported with heart rate 130."],
      }),
    });
    const sbar = buildFallbackSbar(args);
    expect(sbar).toContain("Call 911 now.");
    expect(sbar).toContain("Suspected pulmonary embolism");
    expect(sbar).toContain("Breathlessness reported with heart rate 130.");
  });

  it("names the ECG source as KardiaMobile 6L when present", () => {
    const ecg: EcgReading = {
      recordedAt: "2026-07-20T08:00:00.000Z",
      determination: "tachycardia",
      bpm: 140,
      source: "kardia_6l",
    };
    expect(buildFallbackSbar(baseArgs({ ecg }))).toContain("KardiaMobile 6L");
  });

  it("stays within the 120-word cap even with a long rationale", () => {
    const longRationale = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const sbar = buildFallbackSbar(baseArgs({ decision: decision({ rationale: [longRationale] }) }));
    const words = sbar.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(121); // 120 + ellipsis token
  });
});

describe("parseSbarMessage", () => {
  it("joins and trims text blocks from the message", () => {
    const message = fixtureMessage([fixtureTextBlock("  S: patient is stable.  ")]);
    expect(parseSbarMessage(message, baseArgs())).toBe("S: patient is stable.");
  });

  it("falls back to the deterministic SBAR when Claude returns no text", () => {
    const message = fixtureMessage([]);
    const args = baseArgs({ decision: decision({ action: "Call 911 now." }) });
    expect(parseSbarMessage(message, args)).toContain("Call 911 now.");
  });

  it("truncates a response that exceeds the 120-word cap", () => {
    const longText = Array.from({ length: 150 }, (_, i) => `word${i}`).join(" ");
    const message = fixtureMessage([fixtureTextBlock(longText)]);
    const result = parseSbarMessage(message, baseArgs());
    const words = result.split(/\s+/).filter((w) => w.length > 0);
    expect(words.length).toBeLessThanOrEqual(121);
    expect(result.endsWith("\u2026")).toBe(true);
  });
});

describe("generateSbar", () => {
  it("returns the deterministic fallback when no client is available", async () => {
    const args = baseArgs({ client: null, decision: decision({ action: "Call 911 now." }) });
    const sbar = await generateSbar(args);
    expect(sbar).toContain("Call 911 now.");
  });

  it("calls the injected client with the system prompt and facts, returning parsed text", async () => {
    let capturedParams: Anthropic.MessageCreateParamsNonStreaming | undefined;
    const fakeClient = {
      messages: {
        create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
          capturedParams = params;
          return fixtureMessage([fixtureTextBlock("S: stable. B: POD5. A: green. R: continue plan.")]);
        },
      },
    } as unknown as Anthropic;

    const sbar = await generateSbar(baseArgs({ client: fakeClient }));

    expect(sbar).toBe("S: stable. B: POD5. A: green. R: continue plan.");
    expect(capturedParams?.system).toContain("KardiaMobile 6L");
    expect(capturedParams?.system).toContain("120 words");
    const userContent = capturedParams?.messages[0]?.content;
    expect(typeof userContent === "string" ? userContent : "").toContain("Margaret (demo, synthetic)");
  });
});
