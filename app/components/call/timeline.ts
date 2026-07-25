import type { Decision, VitalsReading } from "@/lib/clinical/types";

/**
 * The call as a list of ordered events, and the pure reducer that turns a
 * cursor into everything the stage view renders.
 *
 * Two properties matter here and both are load-bearing for the demo:
 *
 * 1. A single integer cursor determines the entire screen. Playback advances
 *    it on a timer, the presenter can step it with the arrow keys, and the
 *    screenshot harness freezes it at a named stage — all three read the same
 *    reducer, so what a judge sees on stage is what the capture shows.
 * 2. The tool call is TWO events, `tool-start` and `tool-result`. The gap
 *    between them is the moment the deterministic engine is visibly consulted
 *    mid-call, so it has to be a state the cursor can rest in rather than an
 *    animation detail.
 *
 * No Decision is ever constructed in this module. Every verdict is passed in
 * from `evaluate()` (lib/clinical/red-flag-engine.ts) by the caller.
 */

export type Speaker = "mend" | "margaret";

export interface ToolInput {
  /** Field name as the agent sends it to /api/triage. */
  key: string;
  value: string;
}

interface BaseEvent {
  id: string;
  /** Seconds into the call. */
  at: number;
  /** Reading that becomes current from this event onward, if any. */
  vitals?: VitalsReading;
}

export interface TurnEvent extends BaseEvent {
  kind: "turn";
  speaker: Speaker;
  text: string;
  /**
   * Rule id whose script produced this line word for word. Present only on
   * lines that came from `scriptForDecision()` rather than from the model.
   */
  verbatimFrom?: string;
}

export interface ToolStartEvent extends BaseEvent {
  kind: "tool-start";
  endpoint: string;
  inputs: ToolInput[];
}

export interface ToolResultEvent extends BaseEvent {
  kind: "tool-result";
  startId: string;
  latencyMs: number;
  decision: Decision;
}

export type CallEvent = TurnEvent | ToolStartEvent | ToolResultEvent;

export interface TimelineInput {
  dayPostOp: number;
  /** Reading on the band before she reports the breathlessness. */
  baselineVitals: VitalsReading;
  /** Reading on the band as she reports it. */
  acuteVitals: VitalsReading;
  /** `evaluate()`'s verdict on the baseline reading. */
  routineDecision: Decision;
  /** `evaluate()`'s verdict on the acute reading. */
  escalationDecision: Decision;
  /** `scriptForDecision(escalationDecision)`, spoken verbatim. */
  escalationScript: string;
}

const TRIAGE_ENDPOINT = "POST /api/triage";

function fmt(value: number | undefined, unit: string): string {
  return value === undefined ? "—" : `${value}${unit}`;
}

/**
 * The day-4 check-in call, in the order it happens. Timings are the seconds
 * each line lands at on a real ~90 second call, so unattended playback runs
 * at the pace of the phone call the audience is listening to.
 */
export function buildTimeline(input: TimelineInput): CallEvent[] {
  const { baselineVitals: base, acuteVitals: acute, dayPostOp } = input;

  return [
    {
      kind: "turn",
      id: "t1",
      at: 2,
      speaker: "mend",
      text: `Good morning, Margaret. It's Mend, calling for your day ${dayPostOp} check-in. Yesterday you told me the pain was a four out of ten — how is it this morning?`,
      vitals: base,
    },
    {
      kind: "turn",
      id: "t2",
      at: 13,
      speaker: "margaret",
      text: "Morning, love. About the same. A three, maybe. I slept through, which is more than I managed on Tuesday.",
    },
    {
      kind: "turn",
      id: "t3",
      at: 22,
      speaker: "mend",
      text: "That's good to hear. Have you been up and about with the walker today?",
    },
    {
      kind: "turn",
      id: "t4",
      at: 30,
      speaker: "margaret",
      text: "I have. I got myself to the bathroom and back, though I had to sit down halfway.",
    },
    {
      kind: "tool-start",
      id: "s1",
      at: 35,
      endpoint: TRIAGE_ENDPOINT,
      inputs: [
        { key: "dayPostOp", value: String(dayPostOp) },
        { key: "painScore", value: "3" },
        { key: "painControlled", value: "true" },
        { key: "breathless", value: "false" },
        { key: "hr", value: fmt(base.hr, " bpm") },
        { key: "spo2", value: fmt(base.spo2, "%") },
      ],
    },
    {
      kind: "tool-result",
      id: "r1",
      at: 36,
      startId: "s1",
      latencyMs: 38,
      decision: input.routineDecision,
    },
    {
      kind: "turn",
      id: "t5",
      at: 39,
      speaker: "mend",
      text: "Everything you've told me sits inside the range we expect on day four. And your breathing — any different from yesterday?",
    },
    {
      kind: "turn",
      id: "t6",
      at: 48,
      speaker: "margaret",
      text: "Now you say it — I have been a little short of breath. It started this morning. And my heart feels like it's going.",
      vitals: acute,
    },
    {
      kind: "turn",
      id: "t7",
      at: 57,
      speaker: "mend",
      text: "Thank you for telling me. Stay sitting down for me, Margaret. I'm checking your readings against your safety rules now.",
    },
    {
      kind: "tool-start",
      id: "s2",
      at: 61,
      endpoint: TRIAGE_ENDPOINT,
      inputs: [
        { key: "dayPostOp", value: String(dayPostOp) },
        { key: "breathless", value: "true" },
        { key: "hr", value: fmt(acute.hr, " bpm") },
        { key: "spo2", value: fmt(acute.spo2, "%") },
        { key: "respRate", value: fmt(acute.respRate, " /min") },
      ],
    },
    {
      kind: "tool-result",
      id: "r2",
      at: 62,
      startId: "s2",
      latencyMs: 41,
      decision: input.escalationDecision,
    },
    {
      kind: "turn",
      id: "t8",
      at: 63,
      speaker: "mend",
      text: input.escalationScript,
      verbatimFrom: input.escalationDecision.firedRules[0],
    },
    {
      kind: "turn",
      id: "t9",
      at: 74,
      speaker: "margaret",
      text: "Oh. Right. I'll call them now.",
    },
    {
      kind: "turn",
      id: "t10",
      at: 79,
      speaker: "mend",
      text: "I've already sent your surgeon's team your readings. Stay on the line with me while you dial.",
    },
  ];
}

export interface CallState {
  visible: CallEvent[];
  /** The current verdict: the last tool result revealed, or the opening one. */
  decision: Decision;
  vitals: VitalsReading;
  /** Seconds into the call at this cursor. */
  elapsed: number;
  /** A tool call that has been issued but whose result is not yet revealed. */
  pendingToolId: string | undefined;
}

/**
 * The whole screen, derived from a cursor. `cursor` is the index of the last
 * revealed event; -1 reveals nothing.
 */
export function resolveState(
  events: readonly CallEvent[],
  cursor: number,
  initial: { decision: Decision; vitals: VitalsReading },
): CallState {
  const clamped = Math.max(-1, Math.min(cursor, events.length - 1));
  const visible = events.slice(0, clamped + 1);

  let decision = initial.decision;
  let vitals = initial.vitals;
  let pendingToolId: string | undefined;

  for (const event of visible) {
    if (event.vitals) {
      vitals = event.vitals;
    }
    if (event.kind === "tool-start") {
      pendingToolId = event.id;
    }
    if (event.kind === "tool-result") {
      decision = event.decision;
      if (pendingToolId === event.startId) {
        pendingToolId = undefined;
      }
    }
  }

  return {
    visible,
    decision,
    vitals,
    elapsed: clamped < 0 ? 0 : events[clamped].at,
    pendingToolId,
  };
}

/**
 * Named cursor positions, so the demo and the screenshot harness can both
 * land on an exact frame instead of racing a timer.
 *
 * - `monitoring` — the routine engine check has come back clear; the call is
 *   calm and every reading sits inside the envelope.
 * - `checking`   — the escalating call has been issued to the engine and has
 *   not yet been answered.
 * - `escalated`  — the end of the call, red on screen.
 */
export type CallStage = "monitoring" | "checking" | "escalated";

export function stageCursor(events: readonly CallEvent[], stage: CallStage): number {
  const last = events.length - 1;
  if (stage === "escalated") {
    return last;
  }

  const redResult = events.find(
    (e): e is ToolResultEvent => e.kind === "tool-result" && e.decision.level === "red",
  );
  const startIndex = redResult
    ? events.findIndex((e) => e.id === redResult.startId)
    : -1;

  if (startIndex < 0) {
    return last;
  }
  if (stage === "checking") {
    return startIndex;
  }

  // The calm frame is the last engine answer before the escalation, not
  // simply the event before it — by then she has already reported the
  // breathlessness and her reading has changed.
  const priorResult = events
    .slice(0, startIndex)
    .reduce((found, event, index) => (event.kind === "tool-result" ? index : found), -1);

  return priorResult >= 0 ? priorResult : startIndex - 1;
}

export function parseStage(raw: string | undefined): CallStage | undefined {
  return raw === "monitoring" || raw === "checking" || raw === "escalated"
    ? raw
    : undefined;
}

/** `mm:ss`, tabular-safe. */
export function formatCallClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
