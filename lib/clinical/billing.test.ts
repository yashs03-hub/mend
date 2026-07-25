import { describe, expect, it } from "vitest";
import {
  DEVICE_SUPPLY_DAYS_REQUIRED,
  billableUnits,
  evaluateBilling,
  type BillingLine,
  type BillingPeriod,
} from "./billing";

function period(partial: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    periodStart: "2026-07-01",
    periodEnd: "2026-07-30",
    monitoringDays: 0,
    managementMinutes: 0,
    setupComplete: false,
    interactiveContact: false,
    ...partial,
  };
}

const byCode = (lines: BillingLine[]) =>
  Object.fromEntries(lines.map((l) => [l.code, l]));

describe("evaluateBilling", () => {
  it("reports all eight RPM and RTM codes, in biller order", () => {
    const codes = evaluateBilling(period()).map((l) => l.code);
    expect(codes).toEqual([
      "99453",
      "99454",
      "99457",
      "99458",
      "98975",
      "98977",
      "98980",
      "98981",
    ]);
  });

  it("claims nothing on an empty period", () => {
    const lines = evaluateBilling(period());
    expect(billableUnits(lines)).toBe(0);
    expect(lines.every((l) => l.status !== "met")).toBe(true);
  });

  it("holds device supply until 16 days of data, and names the shortfall", () => {
    const at15 = byCode(evaluateBilling(period({ monitoringDays: 15 })));
    expect(at15["99454"].status).toBe("pending");
    expect(at15["99454"].gap).toBe("1 more monitoring day needed this period");
    expect(at15["99454"].progress).toEqual({
      value: 15,
      target: DEVICE_SUPPLY_DAYS_REQUIRED,
      unit: "days",
    });

    const at16 = byCode(evaluateBilling(period({ monitoringDays: 16 })));
    expect(at16["99454"].status).toBe("met");
    expect(at16["99454"].units).toBe(1);
    expect(at16["99454"].gap).toBeUndefined();
    expect(at16["98977"].status).toBe("met");
  });

  it("will not claim management time without an interactive communication", () => {
    const lines = byCode(
      evaluateBilling(period({ managementMinutes: 45, interactiveContact: false })),
    );
    expect(lines["99457"].status).toBe("pending");
    expect(lines["99457"].gap).toBe("No interactive communication logged this period");
    expect(lines["99458"].units).toBe(0);
  });

  it("claims the first 20-minute increment once, then one unit per further 20", () => {
    const at20 = byCode(
      evaluateBilling(period({ managementMinutes: 20, interactiveContact: true })),
    );
    expect(at20["99457"].units).toBe(1);
    expect(at20["99458"].units).toBe(0);
    expect(at20["99458"].gap).toBe("Next unit at 40 minutes");

    const at45 = byCode(
      evaluateBilling(period({ managementMinutes: 45, interactiveContact: true })),
    );
    expect(at45["99458"].units).toBe(1);
    expect(at45["99458"].gap).toBe("Next unit at 60 minutes");

    const at60 = byCode(
      evaluateBilling(period({ managementMinutes: 60, interactiveContact: true })),
    );
    expect(at60["99458"].units).toBe(2);
  });

  it("names the shortfall in minutes while under the first increment", () => {
    const lines = byCode(
      evaluateBilling(period({ managementMinutes: 12, interactiveContact: true })),
    );
    expect(lines["99457"].gap).toBe("8 more minutes of management time needed");
  });

  it("blocks the RTM management pair while RPM is claiming the same minutes", () => {
    const lines = byCode(
      evaluateBilling(period({ managementMinutes: 45, interactiveContact: true })),
    );
    expect(lines["99457"].status).toBe("met");
    expect(lines["98980"].status).toBe("blocked");
    expect(lines["98980"].units).toBe(0);
    expect(lines["98980"].gap).toContain("99457");
    expect(lines["98981"].status).toBe("blocked");
  });

  it("leaves the RTM management pair claimable when RPM has not met its bar", () => {
    const lines = byCode(
      evaluateBilling(period({ managementMinutes: 10, interactiveContact: true })),
    );
    expect(lines["99457"].status).toBe("pending");
    expect(lines["98980"].status).toBe("pending");
    expect(lines["98980"].gap).not.toContain("99457");
  });

  it("totals a fully-accrued period without double-counting the RTM pair", () => {
    const lines = evaluateBilling(
      period({
        monitoringDays: 22,
        managementMinutes: 45,
        setupComplete: true,
        interactiveContact: true,
      }),
    );
    // 99453 + 99454 + 99457 + 99458 + 98975 + 98977 = 6; 98980/98981 blocked.
    expect(billableUnits(lines)).toBe(6);
  });
});
