import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { extractEcg, mapKardiaDetermination, parseEcgMessage, REPORT_ECG_TOOL } from "./ecg";
import { fixtureMessage, fixtureTextBlock, fixtureToolUseBlock } from "./test-fixtures";

describe("mapKardiaDetermination", () => {
  it.each([
    ["Normal Sinus Rhythm", "normal_sinus_rhythm"],
    ["Atrial Fibrillation", "atrial_fibrillation"],
    ["Tachycardia", "tachycardia"],
    ["Bradycardia", "bradycardia"],
  ] as const)("maps %s -> %s", (raw, expected) => {
    expect(mapKardiaDetermination(raw)).toBe(expected);
  });

  it.each([["Unclassified"], ["Unreadable"]])(
    "maps Kardia's own uncertainty wording %s -> unclassified",
    (raw) => {
      expect(mapKardiaDetermination(raw)).toBe("unclassified");
    },
  );

  it.each([
    [undefined],
    [null],
    [""],
    ["normal sinus rhythm"], // wrong case — never fuzzy-match
    ["Sinus Tachycardia"], // plausible-looking but not an exact Kardia string
    ["Something Claude made up"],
  ])("maps unexpected input %j -> unclassified (never invents a determination)", (raw) => {
    expect(mapKardiaDetermination(raw)).toBe("unclassified");
  });
});

describe("REPORT_ECG_TOOL schema", () => {
  it("forces the exact tool name used by tool_choice", () => {
    expect(REPORT_ECG_TOOL.name).toBe("report_ecg_reading");
  });

  it("requires determination and exposes bpm/recordedAt", () => {
    expect(REPORT_ECG_TOOL.input_schema.required).toContain("determination");
    const props = REPORT_ECG_TOOL.input_schema.properties as Record<string, { type: string }>;
    expect(props.determination.type).toBe("string");
    expect(props.bpm.type).toBe("integer");
    expect(props.recordedAt.type).toBe("string");
  });

  it("instructs Claude to transcribe verbatim, not judge severity", () => {
    const description = REPORT_ECG_TOOL.description ?? "";
    expect(description).toMatch(/exactly as printed/i);
    expect(description).toMatch(/not comment on clinical severity/i);
  });
});

describe("parseEcgMessage", () => {
  it("returns an unclassified fallback when Claude replies with no tool_use block", () => {
    const reading = parseEcgMessage(fixtureMessage([fixtureTextBlock("no tool call")]));
    expect(reading.determination).toBe("unclassified");
    expect(reading.source).toBe("kardia_6l");
  });

  it("maps a normal sinus rhythm reading with bpm and recordedAt", () => {
    const message = fixtureMessage([
      fixtureToolUseBlock("report_ecg_reading", {
        determination: "Normal Sinus Rhythm",
        bpm: 72,
        recordedAt: "2026-07-20T08:00:00.000Z",
      }),
    ]);

    expect(parseEcgMessage(message)).toEqual({
      recordedAt: "2026-07-20T08:00:00.000Z",
      determination: "normal_sinus_rhythm",
      bpm: 72,
      source: "kardia_6l",
    });
  });

  it("maps atrial fibrillation without a bpm (bpm omitted, not invented)", () => {
    const message = fixtureMessage([
      fixtureToolUseBlock("report_ecg_reading", {
        determination: "Atrial Fibrillation",
        recordedAt: "2026-07-20T08:00:00.000Z",
      }),
    ]);

    const reading = parseEcgMessage(message);
    expect(reading.determination).toBe("atrial_fibrillation");
    expect(reading.bpm).toBeUndefined();
  });

  it("never invents a determination for unreadable input — falls back to unclassified", () => {
    const message = fixtureMessage([
      fixtureToolUseBlock("report_ecg_reading", { determination: "Unreadable" }),
    ]);
    expect(parseEcgMessage(message).determination).toBe("unclassified");
  });

  it("ignores a non-object tool input entirely", () => {
    const message = fixtureMessage([fixtureToolUseBlock("report_ecg_reading", "garbage")]);
    expect(parseEcgMessage(message).determination).toBe("unclassified");
  });
});

describe("extractEcg", () => {
  it("returns a neutral unclassified reading when no client is available", async () => {
    const reading = await extractEcg(Buffer.from("fake pdf bytes"), { client: null });
    expect(reading.determination).toBe("unclassified");
    expect(reading.source).toBe("kardia_6l");
  });

  it("sends the PDF as a base64 document content block with tool-forced output", async () => {
    let capturedParams: Anthropic.MessageCreateParamsNonStreaming | undefined;

    const fakeClient = {
      messages: {
        create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
          capturedParams = params;
          return fixtureMessage([
            fixtureToolUseBlock("report_ecg_reading", {
              determination: "Tachycardia",
              bpm: 145,
              recordedAt: "2026-07-20T08:00:00.000Z",
            }),
          ]);
        },
      },
    } as unknown as Anthropic;

    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    const reading = await extractEcg(pdfBuffer, { client: fakeClient });

    expect(reading).toEqual({
      recordedAt: "2026-07-20T08:00:00.000Z",
      determination: "tachycardia",
      bpm: 145,
      source: "kardia_6l",
    });

    expect(capturedParams?.tool_choice).toEqual({ type: "tool", name: "report_ecg_reading" });
    const userMessage = capturedParams?.messages[0];
    const content = userMessage?.content;
    expect(Array.isArray(content)).toBe(true);
    const blocks = content as Anthropic.ContentBlockParam[];
    const documentBlock = blocks.find((b) => b.type === "document");
    expect(documentBlock).toBeDefined();
    expect((documentBlock as Anthropic.DocumentBlockParam).source).toEqual({
      type: "base64",
      media_type: "application/pdf",
      data: pdfBuffer.toString("base64"),
    });
  });
});
