import { TranscriptWord } from "@/lib/clinical/speech";

/**
 * Synthesises the word timings ElevenLabs returns, so the speech signal is
 * demoable before the live widget is wired to a real recording.
 *
 * The phenomenon is encoded in the timing, not asserted in a label: the
 * breathless feed genuinely has shorter runs between longer gaps, so
 * deriveSpeechFeatures() has to actually measure it rather than be told.
 * If the feature extraction were wrong, these fixtures would expose it.
 */

export type SpeechScenario = "baseline" | "breathless" | "slowed";

interface Shape {
  /** Words per run before a breath pause. */
  runLength: number;
  /** Seconds of pause between runs. */
  breathPause: number;
  /** Seconds per word while speaking. */
  wordDuration: number;
  /** Gap between the agent's question and the patient's first word, seconds. */
  responseLatency: number;
  /** Number of runs — governs total speech length. */
  runs: number;
}

const SHAPES: Record<SpeechScenario, Shape> = {
  // Comfortable conversational speech: long phrases, short gaps, prompt replies.
  baseline: { runLength: 12, breathPause: 0.45, wordDuration: 0.29, responseLatency: 0.5, runs: 7 },
  // Dyspnoea: the phrase breaks up and the gaps lengthen. Rate per spoken word
  // barely changes — it is the *chunking* that carries the signal, which is why
  // words-per-breath detects this and a plain word count does not.
  breathless: { runLength: 5, breathPause: 1.15, wordDuration: 0.3, responseLatency: 1.1, runs: 12 },
  // Cognitive slowing: phrases stay long-ish but everything is slower and the
  // patient takes longer to begin answering.
  slowed: { runLength: 9, breathPause: 0.7, wordDuration: 0.46, responseLatency: 3.4, runs: 8 },
};

const FILLER =
  "I slept alright thank you the wound is dry and I did my exercises before lunch with the frame".split(
    " ",
  );

/**
 * @param agentPrompt whether to prepend an agent turn, so response latency is measurable
 */
export function scenarioSpeech(
  scenario: SpeechScenario,
  agentPrompt = true,
): TranscriptWord[] {
  const s = SHAPES[scenario];
  const words: TranscriptWord[] = [];
  let t = 0;

  if (agentPrompt) {
    for (const w of ["How", "are", "you", "feeling", "today", "Margaret"]) {
      words.push({ text: w, start: round(t), end: round(t + 0.28), speaker: "agent" });
      t += 0.32;
    }
    t += s.responseLatency;
  }

  let i = 0;
  for (let run = 0; run < s.runs; run++) {
    for (let k = 0; k < s.runLength; k++) {
      const text = FILLER[i++ % FILLER.length];
      words.push({ text, start: round(t), end: round(t + s.wordDuration), speaker: "patient" });
      // Within a run, words butt up against each other with a small natural gap.
      t += s.wordDuration + 0.06;
    }
    t += s.breathPause;
  }

  return words;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
