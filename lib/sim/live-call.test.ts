import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLiveCall,
  getLiveCall,
  startLiveCall,
  subscribeLiveCall,
} from "./live-call";

const STORAGE_KEY = "mend.liveCall";

function inactiveState() {
  return {
    active: false,
    conversationId: null,
    startedAt: null,
    source: null,
  };
}

describe("live-call session store", () => {
  beforeEach(() => {
    clearLiveCall();
    vi.useRealTimers();
  });

  afterEach(() => {
    clearLiveCall();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("defaults to inactive", () => {
    expect(getLiveCall()).toEqual(inactiveState());
  });

  it("startLiveCall sets active state with conversation, source, and startedAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    startLiveCall({ conversationId: "conv_abc", source: "clinician" });

    expect(getLiveCall()).toEqual({
      active: true,
      conversationId: "conv_abc",
      startedAt: 1_700_000_000_000,
      source: "clinician",
    });
  });

  it("startLiveCall accepts null conversationId and patient source", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);

    startLiveCall({ conversationId: null, source: "patient" });

    expect(getLiveCall()).toMatchObject({
      active: true,
      conversationId: null,
      startedAt: 42,
      source: "patient",
    });
  });

  it("clearLiveCall resets to inactive", () => {
    startLiveCall({ conversationId: "conv_x", source: "clinician" });
    clearLiveCall();
    expect(getLiveCall()).toEqual(inactiveState());
  });

  it("subscribeLiveCall notifies on start and clear, and unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLiveCall(listener);

    startLiveCall({ conversationId: "c1", source: "clinician" });
    clearLiveCall();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    startLiveCall({ conversationId: "c2", source: "patient" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("persists to sessionStorage under mend.liveCall when window is available", () => {
    const store = new Map<string, string>();
    const sessionStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("window", {
      sessionStorage: sessionStorageMock,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("sessionStorage", sessionStorageMock);

    clearLiveCall();
    vi.spyOn(Date, "now").mockReturnValue(99);
    startLiveCall({ conversationId: "stored", source: "patient" });

    expect(store.get(STORAGE_KEY)).toBeTruthy();
    expect(JSON.parse(store.get(STORAGE_KEY)!)).toEqual({
      active: true,
      conversationId: "stored",
      startedAt: 99,
      source: "patient",
    });

    clearLiveCall();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("notifies listeners on storage events for mend.liveCall", () => {
    const eventListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    let stored: string | null = null;
    const sessionStorageMock = {
      getItem: (key: string) => (key === STORAGE_KEY ? stored : null),
      setItem: (key: string, value: string) => {
        if (key === STORAGE_KEY) stored = value;
      },
      removeItem: (key: string) => {
        if (key === STORAGE_KEY) stored = null;
      },
    };
    const windowMock = {
      sessionStorage: sessionStorageMock,
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (!eventListeners.has(type)) eventListeners.set(type, new Set());
        eventListeners.get(type)!.add(listener);
      },
      removeEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        eventListeners.get(type)?.delete(listener);
      },
    };
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("sessionStorage", sessionStorageMock);

    const listener = vi.fn();
    const unsubscribe = subscribeLiveCall(listener);

    const storageListeners = eventListeners.get("storage");
    expect(storageListeners?.size).toBeGreaterThan(0);

    const payload = {
      active: true,
      conversationId: "from-other-tab",
      startedAt: 123,
      source: "clinician" as const,
    };
    stored = JSON.stringify(payload);

    for (const fn of storageListeners ?? []) {
      const handler = typeof fn === "function" ? fn : fn.handleEvent.bind(fn);
      handler({
        key: STORAGE_KEY,
        newValue: stored,
      } as StorageEvent);
    }

    expect(listener).toHaveBeenCalled();
    expect(getLiveCall()).toEqual(payload);

    unsubscribe();
  });
});
