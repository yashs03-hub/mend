import { describe, expect, it } from "vitest";
import { composeDecision } from "../clinical/compose";
import { getPhase } from "../clinical/recovery-graph";
import { evaluate } from "../clinical/red-flag-engine";
import { evaluateTrends } from "../clinical/trends";
import { buildRoster, findPatient, rosterIds } from "./roster";

const roster = buildRoster();
const byId = Object.fromEntries(roster.map((p) => [p.id, p]));

describe("buildRoster", () => {
  it("carries five patients and no duplicate ids", () => {
    expect(roster).toHaveLength(5);
    expect(new Set(roster.map((p) => p.id)).size).toBe(5);
    expect(rosterIds().sort()).toEqual(roster.map((p) => p.id).sort());
  });

  it("sorts by severity first, then by most recent check-in", () => {
    const rank = { red: 0, amber: 1, green: 2 } as const;
    for (let i = 1; i < roster.length; i++) {
      const prev = roster[i - 1];
      const next = roster[i];
      const prevRank = rank[prev.latest.decision.level];
      const nextRank = rank[next.latest.decision.level];

      expect(prevRank).toBeLessThanOrEqual(nextRank);
      if (prevRank === nextRank) {
        expect(Date.parse(prev.latest.at)).toBeGreaterThanOrEqual(
          Date.parse(next.latest.at),
        );
      }
    }
  });

  it("puts one red at the top so a nurse never scrolls past green to reach it", () => {
    expect(roster[0].latest.decision.level).toBe("red");
    expect(roster.filter((p) => p.latest.decision.level === "red")).toHaveLength(1);
  });

  it("covers all three severities, so the worklist is a worklist and not one alarm", () => {
    expect(new Set(roster.map((p) => p.latest.decision.level))).toEqual(
      new Set(["red", "amber", "green"]),
    );
  });
});

describe("every verdict is the engine's, not authored copy", () => {
  it("re-derives identically when evaluate/evaluateTrends/composeDecision are re-run", () => {
    for (const patient of roster) {
      const vitals = patient.checkins.map((c) => c.vitals);
      const symptoms = patient.checkins.map((c) => c.symptoms);

      patient.checkins.forEach((checkin, index) => {
        const phase = getPhase(checkin.dayPostOp);
        const base = evaluate({
          dayPostOp: checkin.dayPostOp,
          symptoms: checkin.symptoms,
          vitals: checkin.vitals,
          ecg: checkin.ecg,
        });
        const trends = evaluateTrends(
          vitals.slice(0, index + 1),
          symptoms.slice(0, index + 1),
          phase,
        );

        expect(checkin.baseDecision, `${patient.id} day ${checkin.dayPostOp}`).toEqual(base);
        expect(checkin.trendFindings).toEqual(trends);
        expect(checkin.decision).toEqual(composeDecision(base, trends));
      });
    }
  });

  it("never records a green check-in as an escalation", () => {
    for (const patient of roster) {
      const nonGreen = patient.checkins.filter((c) => c.decision.level !== "green");
      expect(patient.openEscalations + patient.closedEscalations).toBe(nonGreen.length);
    }
  });
});

describe("the four clinical stories the worklist has to tell", () => {
  it("Margaret is the acute escalation: red on the fixture's own PE reading", () => {
    const margaret = byId["margaret-ellison"];
    expect(margaret.latest.decision.level).toBe("red");
    expect(margaret.latest.decision.condition).toBe("Suspected pulmonary embolism");
    expect(margaret.latest.decision.firedRules).toEqual(["pe.breathless_with_tachycardia"]);
    expect(margaret.latest.vitals.hr).toBe(122);
  });

  it("Doris is the slow infection: amber on a threshold her own earlier days cleared", () => {
    const doris = byId["doris-whitfield"];
    expect(doris.latest.decision.condition).toBe("Possible wound infection");
    expect(doris.checkins[0].decision.level).toBe("green");
    expect(doris.latest.trendFindings.map((f) => f.id)).toContain("trend.tempc.rising");
  });

  it("Eileen is the trend case: every reading inside the envelope, amber only on trajectory", () => {
    const eileen = byId["eileen-prosser"];
    const phase = getPhase(eileen.dayPostOp);

    expect(eileen.latest.baseDecision.level).toBe("green");
    expect(eileen.latest.decision.level).toBe("amber");
    expect(eileen.latest.decision.firedRules).toContain("trend.raised_green_to_amber");
    // The point of the case: the number that would have tripped a threshold
    // engine never actually trips it.
    for (const checkin of eileen.checkins) {
      expect(checkin.vitals.hr ?? 0).toBeLessThanOrEqual(phase.normalEnvelope.hrMax);
    }
  });

  it("Beatrice spans a phase change, so her envelope tightens under an unchanged patient", () => {
    const beatrice = byId["beatrice-nkemelu"];
    const phases = new Set(beatrice.checkins.map((c) => getPhase(c.dayPostOp).name));

    expect(phases.size).toBe(3);
    expect(beatrice.latest.decision.level).toBe("green");
    expect(beatrice.closedEscalations).toBe(1);
    expect(beatrice.openEscalations).toBe(0);
  });
});

describe("billing accrual is counted, not asserted", () => {
  it("counts one monitoring day per check-in and sums the logged review time", () => {
    for (const patient of roster) {
      expect(patient.billing.monitoringDays).toBe(patient.checkins.length);
      expect(patient.billing.managementMinutes).toBe(
        patient.checkins.reduce((sum, c) => sum + c.managementMinutes, 0),
      );
    }
  });

  it("gives at least one patient enough days to clear the 16-in-30 device-supply bar", () => {
    expect(roster.some((p) => p.billing.monitoringDays >= 16)).toBe(true);
  });
});

describe("findPatient", () => {
  it("finds a known patient and returns undefined for an unknown one", () => {
    expect(findPatient("margaret-ellison")?.name).toBe("Margaret Ellison");
    expect(findPatient("nobody")).toBeUndefined();
  });
});
