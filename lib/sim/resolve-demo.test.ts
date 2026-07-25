import { afterEach, describe, expect, it } from "vitest";
import { getActiveScenario, setActiveScenario } from "./active-scenario";
import { resolveCallStage, resolveFamilyScenario } from "./resolve-demo";

describe("resolveFamilyScenario", () => {
  it("lets an explicit state=attention beat the active store", () => {
    expect(resolveFamilyScenario("attention", "green")).toBe("drift");
    expect(resolveFamilyScenario("attention", "pe")).toBe("drift");
  });

  it("lets an explicit state=well beat the active store", () => {
    expect(resolveFamilyScenario("well", "pe")).toBe("green");
    expect(resolveFamilyScenario("well", "drift")).toBe("green");
  });

  it("falls through to the active scenario when no state param is set", () => {
    expect(resolveFamilyScenario(undefined, "pe")).toBe("pe");
    expect(resolveFamilyScenario(undefined, "drift")).toBe("drift");
    expect(resolveFamilyScenario(undefined, "green")).toBe("green");
  });

  it("ignores unrecognized state values and uses the store", () => {
    expect(resolveFamilyScenario("amber", "pe")).toBe("pe");
    expect(resolveFamilyScenario("", "drift")).toBe("drift");
  });
});

describe("resolveCallStage", () => {
  it("lets an explicit stage query beat the active store", () => {
    expect(resolveCallStage("escalated", "green")).toBe("escalated");
    expect(resolveCallStage("checking", "green")).toBe("checking");
    expect(resolveCallStage("monitoring", "pe")).toBe("monitoring");
  });

  it("maps pe → escalated and green/drift → monitoring when no stage param", () => {
    expect(resolveCallStage(undefined, "pe")).toBe("escalated");
    expect(resolveCallStage(undefined, "green")).toBe("monitoring");
    expect(resolveCallStage(undefined, "drift")).toBe("monitoring");
  });

  it("returns undefined while playing so playback can start at cursor 0", () => {
    expect(resolveCallStage(undefined, "pe", { playing: true })).toBeUndefined();
    expect(resolveCallStage(undefined, "green", { playing: true })).toBeUndefined();
  });

  it("still honours an explicit stage even when play was requested", () => {
    expect(resolveCallStage("checking", "pe", { playing: true })).toBe("checking");
  });
});

describe("resolve helpers against the live active-scenario store", () => {
  afterEach(() => {
    setActiveScenario("green");
  });

  it("store beats the default when no query param is present", () => {
    setActiveScenario("pe");
    expect(getActiveScenario()).toBe("pe");
    expect(resolveFamilyScenario(undefined, getActiveScenario())).toBe("pe");
    expect(resolveCallStage(undefined, getActiveScenario())).toBe("escalated");
  });
});
