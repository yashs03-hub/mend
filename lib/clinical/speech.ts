/**
 * Speech-derived respiratory and cognitive signals, computed from the word
 * timings ElevenLabs already returns with every transcript.
 *
 * WHY COMPUTE RATHER THAN BUY. The two weakest inputs in the engine are
 * `breathless` and `newConfusion`, and both are weak for the same reason: they
 * are self-reported. A breathless patient may under-report; a confused patient
 * is the least reliable possible witness to their own confusion. Neither can be
 * fixed by reading the transcript more carefully, because the information is in
 * *how* the words were said, not which words they were.
 *
 * Breathlessness has an acoustic signature that needs no vendor: people short
 * of breath speak in shorter runs between inhalations. Cognitive slowing shows
 * up as latency and hesitation. Both fall out of timestamps we already have.
 *
 * WHY BASELINE-RELATIVE. An absolute cut-point ("fewer than 6 words per breath
 * is abnormal") would be another uncited threshold, and worse, one validated —
 * if at all — on a different population, microphone, and task. Comparing
 * Margaret to Margaret removes all three confounds at once: same person, same
 * device, same daily question. A 40% fall in her own words-per-breath is
 * meaningful in a way that an absolute number across a population is not.
 *
 * ⚠️ THESE FEATURES DO NOT CURRENTLY CHANGE ANY VERDICT. They are surfaced to
 * the clinician as corroborating context only. Letting an unvalidated signal
 * escalate someone to 911 is exactly the mistake this codebase is built to
 * avoid — see docs/CLINICAL_SOURCES.md.
 */

/** A word with timings, as returned by a speech-to-text engine. Times in seconds. */
export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  speaker?: "patient" | "agent";
}

export interface SpeechFeatures {
  /** Mean words spoken between pauses long enough to be a breath. The headline signal. */
  wordsPerBreathGroup: number;
  /** Longest uninterrupted run — sensitive to effort in a way the mean can mask. */
  longestRunWords: number;
  /** Pauses per minute of speech. Rises with both breathlessness and word-finding difficulty. */
  pausesPerMinute: number;
  /** Speaking rate excluding pause time, words/min. Falls with cognitive slowing. */
  speechRateWpm: number;
  /** Share of elapsed time spent not speaking. */
  pauseRatio: number;
  /** Mean gap between the agent finishing and the patient starting, ms. Latency proxy. */
  responseLatencyMs: number | null;
  /** Total patient speech, seconds. */
  speakingSeconds: number;
  /** Below a floor of speech, none of the above means anything. */
  quality: "ok" | "insufficient";
}

/**
 * A pause long enough to plausibly be an inhalation rather than a word
 * boundary. Conversational speech has gaps of ~50-200ms between words; a
 * breath is typically longer. 300ms is a deliberately conservative floor —
 * it under-counts breath groups rather than inventing them.
 */
export const BREATH_PAUSE_SECONDS = 0.3;

/** Below this there is not enough speech for a stable estimate. */
export const MIN_SPEAKING_SECONDS = 8;

export function deriveSpeechFeatures(
  words: TranscriptWord[],
  breathPause = BREATH_PAUSE_SECONDS,
): SpeechFeatures {
  const patient = words
    .filter((w) => w.speaker !== "agent")
    .slice()
    .sort((a, b) => a.start - b.start);

  const empty: SpeechFeatures = {
    wordsPerBreathGroup: 0,
    longestRunWords: 0,
    pausesPerMinute: 0,
    speechRateWpm: 0,
    pauseRatio: 0,
    responseLatencyMs: null,
    speakingSeconds: 0,
    quality: "insufficient",
  };

  if (patient.length < 2) return empty;

  // Split into breath groups on gaps at or beyond the breath threshold.
  const runs: number[] = [];
  let current = 1;
  let pauseCount = 0;
  let pausedSeconds = 0;

  for (let i = 1; i < patient.length; i++) {
    const gap = patient[i].start - patient[i - 1].end;
    if (gap >= breathPause) {
      runs.push(current);
      current = 1;
      pauseCount++;
      pausedSeconds += gap;
    } else {
      current++;
    }
  }
  runs.push(current);

  const spokenSeconds = patient.reduce((a, w) => a + Math.max(0, w.end - w.start), 0);
  const elapsed = patient[patient.length - 1].end - patient[0].start;
  const speakingSeconds = Math.max(spokenSeconds, 0);

  // Response latency: agent stops, patient starts. Averaged over every handover.
  const latencies: number[] = [];
  const ordered = words.slice().sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i - 1].speaker === "agent" && ordered[i].speaker === "patient") {
      const gap = ordered[i].start - ordered[i - 1].end;
      if (gap >= 0 && gap < 15) latencies.push(gap * 1000);
    }
  }

  const minutesOfSpeech = speakingSeconds / 60;

  return {
    wordsPerBreathGroup: round(runs.reduce((a, b) => a + b, 0) / runs.length),
    longestRunWords: Math.max(...runs),
    pausesPerMinute: minutesOfSpeech > 0 ? round(pauseCount / minutesOfSpeech) : 0,
    speechRateWpm: minutesOfSpeech > 0 ? round(patient.length / minutesOfSpeech) : 0,
    pauseRatio: elapsed > 0 ? round(pausedSeconds / elapsed, 3) : 0,
    responseLatencyMs: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null,
    speakingSeconds: round(speakingSeconds, 1),
    quality: speakingSeconds >= MIN_SPEAKING_SECONDS ? "ok" : "insufficient",
  };
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Baseline comparison — the part that is actually defensible
// ---------------------------------------------------------------------------

export type SpeechTrend = "stable" | "reduced" | "markedly_reduced" | "unknown";

export interface SpeechComparison {
  trend: SpeechTrend;
  /** Negative means fewer words per breath than this patient's own baseline. */
  wordsPerBreathPctChange: number | null;
  speechRatePctChange: number | null;
  latencyPctChange: number | null;
  /** Plain-English lines for the clinician handoff. */
  notes: string[];
}

/**
 * Percentage bands are a presentation choice, not a clinical claim: they decide
 * what gets highlighted, never what gets escalated. A -25% band was chosen to
 * be clearly outside day-to-day variation while staying sensitive; it needs
 * empirical calibration against real repeat measurements before it could ever
 * gate a decision.
 */
const REDUCED_PCT = -25;
const MARKEDLY_REDUCED_PCT = -40;

export function compareToBaseline(
  today: SpeechFeatures,
  baseline: SpeechFeatures | null,
): SpeechComparison {
  if (!baseline || baseline.quality !== "ok" || today.quality !== "ok") {
    return {
      trend: "unknown",
      wordsPerBreathPctChange: null,
      speechRatePctChange: null,
      latencyPctChange: null,
      notes: [
        !baseline
          ? "No prior check-in to compare against — today establishes the baseline."
          : "Not enough speech in one of the recordings for a reliable comparison.",
      ],
    };
  }

  const pct = (now: number, was: number) =>
    was > 0 ? round(((now - was) / was) * 100) : null;

  const breath = pct(today.wordsPerBreathGroup, baseline.wordsPerBreathGroup);
  const rate = pct(today.speechRateWpm, baseline.speechRateWpm);
  const latency =
    today.responseLatencyMs !== null && baseline.responseLatencyMs !== null
      ? pct(today.responseLatencyMs, baseline.responseLatencyMs)
      : null;

  const notes: string[] = [];
  if (breath !== null) {
    notes.push(
      `Words per breath ${today.wordsPerBreathGroup} vs baseline ${baseline.wordsPerBreathGroup} (${signed(breath)}%)`,
    );
  }
  if (rate !== null) {
    notes.push(
      `Speech rate ${today.speechRateWpm} vs ${baseline.speechRateWpm} wpm (${signed(rate)}%)`,
    );
  }
  if (latency !== null && latency > 50) {
    notes.push(
      `Response latency ${today.responseLatencyMs}ms vs ${baseline.responseLatencyMs}ms (${signed(latency)}%) — slower than usual`,
    );
  }

  // The trend follows the worst of the two respiratory-relevant measures.
  const worst = Math.min(breath ?? 0, rate ?? 0);
  const trend: SpeechTrend =
    worst <= MARKEDLY_REDUCED_PCT
      ? "markedly_reduced"
      : worst <= REDUCED_PCT
        ? "reduced"
        : "stable";

  return {
    trend,
    wordsPerBreathPctChange: breath,
    speechRatePctChange: rate,
    latencyPctChange: latency,
    notes,
  };
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
