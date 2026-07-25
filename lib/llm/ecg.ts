import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, getAnthropicModel } from "./client";
import type { EcgDetermination, EcgReading } from "../clinical/types";

const REPORT_ECG_TOOL_NAME = "report_ecg_reading";

/**
 * Tool-forced schema for a single KardiaMobile 6L PDF. Claude transcribes
 * exactly what is printed on the report — the FDA-cleared determination
 * string, the reported heart rate, and the recording time. It never
 * reinterprets or upgrades/downgrades the determination, and it never
 * comments on clinical severity; `mapKardiaDetermination` below (a pure,
 * non-LLM function) is the only place that touches the wording, and
 * `evaluate()` in red-flag-engine.ts is the only place that judges it.
 */
export const REPORT_ECG_TOOL: Anthropic.Tool = {
  name: REPORT_ECG_TOOL_NAME,
  description:
    "Transcribe ONLY what is printed on this KardiaMobile 6L ECG PDF report: its " +
    "FDA-cleared rhythm determination string, the heart rate it reports, and the " +
    "recording date/time. Copy the determination exactly as printed — do not " +
    "reinterpret, normalize, upgrade, downgrade, or guess it. If a field is " +
    "missing, unreadable, or ambiguous, report the determination as printed " +
    "(e.g. \"Unclassified\" or \"Unreadable\") rather than inventing a value. Do " +
    "not comment on clinical severity and do not give advice.",
  input_schema: {
    type: "object",
    properties: {
      determination: {
        type: "string",
        description:
          'The rhythm determination exactly as printed, e.g. "Normal Sinus Rhythm", ' +
          '"Atrial Fibrillation", "Tachycardia", "Bradycardia", "Unclassified", or "Unreadable".',
      },
      bpm: {
        type: "integer",
        description: "The heart rate in beats per minute as printed on the report, if present.",
      },
      recordedAt: {
        type: "string",
        description:
          "The recording date/time as printed on the report. Use ISO 8601 if it can be " +
          "determined unambiguously, otherwise copy the raw printed string.",
      },
    },
    required: ["determination"],
    additionalProperties: false,
  },
};

/**
 * Pure mapping from Kardia's exact printed wording to the `EcgDetermination`
 * union. No inference: anything not an exact match — including
 * "Unclassified" and "Unreadable" — maps to `unclassified`, which
 * red-flag-engine.ts already treats as absent (falls back to symptom
 * rules). Mend must never invent a determination Claude did not find.
 */
export function mapKardiaDetermination(raw: string | null | undefined): EcgDetermination {
  switch (raw?.trim()) {
    case "Normal Sinus Rhythm":
      return "normal_sinus_rhythm";
    case "Atrial Fibrillation":
      return "atrial_fibrillation";
    case "Tachycardia":
      return "tachycardia";
    case "Bradycardia":
      return "bradycardia";
    default:
      return "unclassified";
  }
}

export interface ExtractEcgDeps {
  /** Injected for tests; omit to use the real client from client.ts. */
  client?: Anthropic | null;
  model?: string;
}

function neutralFallback(): EcgReading {
  return {
    recordedAt: new Date().toISOString(),
    determination: "unclassified",
    source: "kardia_6l",
  };
}

/**
 * Extracts `{ determination, bpm, recordedAt }` from a KardiaMobile 6L PDF
 * via a tool-forced Claude call. Degrades gracefully: with no Anthropic
 * client available this logs a warning and returns a neutral `unclassified`
 * reading rather than crashing or inventing a finding.
 */
export async function extractEcg(
  pdf: Buffer | string,
  deps: ExtractEcgDeps = {},
): Promise<EcgReading> {
  const client = deps.client !== undefined ? deps.client : createAnthropicClient();
  if (!client) {
    console.warn("[llm] extractEcg: no Anthropic client available — returning unclassified EcgReading.");
    return neutralFallback();
  }

  const base64 = typeof pdf === "string" ? pdf : pdf.toString("base64");
  const model = deps.model ?? getAnthropicModel();

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system:
      "You transcribe data printed on ECG PDF reports. You never assess severity, " +
      "give advice, or decide on escalation.",
    tools: [REPORT_ECG_TOOL],
    tool_choice: { type: "tool", name: REPORT_ECG_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: "Extract the rhythm determination, heart rate, and recording time from this KardiaMobile 6L ECG report.",
          },
        ],
      },
    ],
  });

  return parseEcgMessage(message);
}

/** Pure, network-free: pulls the tool_use block out of a Message and maps
 * it into an `EcgReading`. Exported for testing against recorded fixture
 * messages. */
export function parseEcgMessage(message: Anthropic.Message): EcgReading {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === REPORT_ECG_TOOL_NAME,
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    return neutralFallback();
  }

  const raw = toolUse.input as Record<string, unknown>;
  const determination = mapKardiaDetermination(
    typeof raw.determination === "string" ? raw.determination : undefined,
  );
  const bpm =
    typeof raw.bpm === "number" && Number.isFinite(raw.bpm) ? Math.round(raw.bpm) : undefined;
  const recordedAt =
    typeof raw.recordedAt === "string" && raw.recordedAt.trim() !== ""
      ? raw.recordedAt
      : new Date().toISOString();

  return {
    recordedAt,
    determination,
    ...(bpm !== undefined ? { bpm } : {}),
    source: "kardia_6l",
  };
}
