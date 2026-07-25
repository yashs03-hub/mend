import { describe, it, expect } from "vitest";
import {
  deriveSpeechFeatures,
  compareToBaseline,
  TranscriptWord,
  MIN_SPEAKING_SECONDS,
} from "./speech";
import { scenarioSpeech } from "@/lib/sim/speech-feed";

/** Builds a run of `n` words starting at `t`, each `dur` long with `gap` between. */
function run(n: number, t: number, dur = 0.3, gap = 0.06): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ text: `w${i}`, start: t, end: t + dur, speaker: "patient" });
    t += dur + gap;
  }
  return out;
}

describe("deriveSpeechFeatures", () => {
  it("counts a single uninterrupted run as one breath group", () => {
    const f = deriveSpeechFeatures(run(10, 0));
    expect(f.wordsPerBreathGroup).toBe(10);
    expect(f.longestRunWords).toBe(10);
    expect(f.pausesPerMinute).toBe(0);
  });

  it("splits on a pause at or beyond the breath threshold", () => {
    // Two runs of 5, separated by a 1s gap.
    const a = run(5, 0);
    const b = run(5, a[a.length - 1].end + 1.0);
    const f = deriveSpeechFeatures([...a, ...b]);
    expect(f.wordsPerBreathGroup).toBe(5);
    expect(f.longestRunWords).toBe(5);
  });

  it("does not split on ordinary between-word gaps", () => {
    const f = deriveSpeechFeatures(run(8, 0, 0.3, 0.1)); // 100ms gaps
    expect(f.wordsPerBreathGroup).toBe(8);
  });

  it("marks quality insufficient below the speech floor", () => {
    const f = deriveSpeechFeatures(run(3, 0, 0.3));
    expect(f.speakingSeconds).toBeLessThan(MIN_SPEAKING_SECONDS);
    expect(f.quality).toBe("insufficient");
  });

  it("handles degenerate input without throwing", () => {
    expect(deriveSpeechFeatures([]).quality).toBe("insufficient");
    expect(deriveSpeechFeatures(run(1, 0)).quality).toBe("insufficient");
  });

  it("ignores agent words when measuring the patient", () => {
    const agent: TranscriptWord[] = [
      { text: "how", start: 0, end: 0.3, speaker: "agent" },
      { text: "are", start: 0.4, end: 0.7, speaker: "agent" },
    ];
    const f = deriveSpeechFeatures([...agent, ...run(10, 2)]);
    expect(f.longestRunWords).toBe(10);
  });

  it("measures response latency across the agent-to-patient handover", () => {
    const words: TranscriptWord[] = [
      { text: "hello", start: 0, end: 0.5, speaker: "agent" },
      ...run(10, 2.5), // 2.0s after the agent stops
    ];
    const f = deriveSpeechFeatures(words);
    expect(f.responseLatencyMs).toBeGreaterThan(1900);
    expect(f.responseLatencyMs).toBeLessThan(2100);
  });
});

/**
 * The signal has to survive the feature extraction, not just be asserted in a
 * fixture — so these run the simulated timings through the real derivation.
 */
describe("the simulated scenarios produce the intended signal", () => {
  const base = deriveSpeechFeatures(scenarioSpeech("baseline"));
  const breathless = deriveSpeechFeatures(scenarioSpeech("breathless"));
  const slowed = deriveSpeechFeatures(scenarioSpeech("slowed"));

  it("all three produce enough speech to be usable", () => {
    for (const f of [base, breathless, slowed]) expect(f.quality).toBe("ok");
  });

  it("breathlessness shortens the breath group", () => {
    expect(breathless.wordsPerBreathGroup).toBeLessThan(base.wordsPerBreathGroup * 0.6);
  });

  it("breathlessness raises pause frequency", () => {
    expect(breathless.pausesPerMinute).toBeGreaterThan(base.pausesPerMinute);
  });

  it("cognitive slowing shows in rate and latency, NOT mainly in breath grouping", () => {
    expect(slowed.speechRateWpm).toBeLessThan(base.speechRateWpm);
    expect(slowed.responseLatencyMs!).toBeGreaterThan(base.responseLatencyMs! * 2);
    // The discriminating property: slowing does not fragment phrases the way
    // dyspnoea does, so the two are separable rather than one "unwell" score.
    expect(slowed.wordsPerBreathGroup).toBeGreaterThan(breathless.wordsPerBreathGroup);
  });
});

describe("compareToBaseline", () => {
  const base = deriveSpeechFeatures(scenarioSpeech("baseline"));

  it("reports unknown with no baseline, rather than guessing", () => {
    const c = compareToBaseline(base, null);
    expect(c.trend).toBe("unknown");
    expect(c.notes[0]).toMatch(/baseline/i);
  });

  it("calls an unchanged recording stable", () => {
    expect(compareToBaseline(base, base).trend).toBe("stable");
  });

  it("flags breathlessness as markedly reduced against the patient's own baseline", () => {
    const c = compareToBaseline(deriveSpeechFeatures(scenarioSpeech("breathless")), base);
    expect(c.trend).toBe("markedly_reduced");
    expect(c.wordsPerBreathPctChange!).toBeLessThan(-40);
  });

  it("produces clinician-readable notes carrying both numbers", () => {
    const c = compareToBaseline(deriveSpeechFeatures(scenarioSpeech("breathless")), base);
    expect(c.notes.join(" ")).toMatch(/words per breath/i);
    expect(c.notes.join(" ")).toMatch(/baseline/i);
  });

  it("refuses to compare when either recording is too short", () => {
    const thin = deriveSpeechFeatures(run(3, 0));
    expect(compareToBaseline(thin, base).trend).toBe("unknown");
    expect(compareToBaseline(base, thin).trend).toBe("unknown");
  });
});
