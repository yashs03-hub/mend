import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveScenario,
  isScenario,
  loadActiveScenario,
  persistActiveScenario,
  setActiveScenario,
  SCENARIOS,
} from "./active-scenario";

describe("active scenario store", () => {
  afterEach(() => {
    setActiveScenario("green");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("defaults to green", () => {
    expect(getActiveScenario()).toBe("green");
  });

  it("round-trips every declared scenario in-process", () => {
    for (const scenario of SCENARIOS) {
      expect(setActiveScenario(scenario)).toBe(scenario);
      expect(getActiveScenario()).toBe(scenario);
    }
  });

  it("isScenario accepts only the three fixture keys", () => {
    expect(isScenario("green")).toBe(true);
    expect(isScenario("pe")).toBe(true);
    expect(isScenario("drift")).toBe(true);
    expect(isScenario("amber")).toBe(false);
    expect(isScenario("")).toBe(false);
    expect(isScenario(null)).toBe(false);
  });

  it("loadActiveScenario falls back to in-process when Supabase is unconfigured", async () => {
    setActiveScenario("drift");
    expect(await loadActiveScenario()).toBe("drift");
  });

  it("persistActiveScenario updates in-process even when Supabase is unconfigured", async () => {
    expect(await persistActiveScenario("pe")).toBe("pe");
    expect(getActiveScenario()).toBe("pe");
  });
});

describe("active scenario durable store (Supabase REST)", () => {
  beforeEach(() => {
    setActiveScenario("green");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    setActiveScenario("green");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loadActiveScenario hydrates from demo_state when the row is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ value: "pe" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    // Simulate a cold isolate whose in-process store still says green.
    setActiveScenario("green");
    expect(await loadActiveScenario()).toBe("pe");
    expect(getActiveScenario()).toBe("pe");
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/rest/v1/demo_state");
    expect(url).toContain("active_scenario");
  });

  it("persistActiveScenario upserts demo_state then keeps in-process in sync", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    expect(await persistActiveScenario("drift")).toBe("drift");
    expect(getActiveScenario()).toBe("drift");

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/rest/v1/demo_state");
    expect(init).toMatchObject({ method: "POST" });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({ key: "active_scenario", value: "drift" });
  });

  it("loadActiveScenario keeps in-process value when durable read fails", async () => {
    setActiveScenario("drift");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => [] }),
    );

    expect(await loadActiveScenario()).toBe("drift");
  });
});
