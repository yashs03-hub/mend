import { describe, it, expect } from "vitest";
import { getPhase, HIP_RECOVERY } from "./recovery-graph";

describe("getPhase", () => {
  it("returns the immobilise/protect phase on day 2", () => {
    const p = getPhase(2);
    expect(p.name).toBe("Early protected");
    expect(p.normalEnvelope.tempCMax).toBe(38.0); // low-grade temp normal early
    expect(p.weightBearing).toMatch(/frame|walker/i);
  });

  it("tightens the temp envelope by week 3", () => {
    expect(getPhase(21).normalEnvelope.tempCMax).toBe(37.5);
  });

  it("clamps days beyond the graph to the last phase", () => {
    expect(getPhase(999).name).toBe("Strengthening");
    expect(getPhase(5000).name).toBe("Strengthening");
  });

  it("clamps negative or pre-op days to the first phase rather than throwing", () => {
    expect(getPhase(-1).name).toBe("Early protected");
  });

  it("covers every day from 0 to 999 with no gaps between phases", () => {
    for (let d = 0; d <= 999; d++) {
      expect(getPhase(d)).toBeDefined();
    }
    for (let i = 1; i < HIP_RECOVERY.length; i++) {
      expect(HIP_RECOVERY[i].dayStart).toBe(HIP_RECOVERY[i - 1].dayEnd + 1);
    }
  });
});
