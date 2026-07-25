import { afterEach, describe, expect, it, vi } from "vitest";
import type { CallFetch, StartCheckInCallInput } from "./call";

const ENV_KEYS = ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_AGENT_PHONE_NUMBER_ID"] as const;

async function freshCallModule() {
  vi.resetModules();
  return import("./call");
}

function setAllCredentials() {
  process.env.ELEVENLABS_API_KEY = "test-xi-key";
  process.env.ELEVENLABS_AGENT_ID = "agent-123";
  process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID = "phone-456";
}

function basePatient(partial: Partial<StartCheckInCallInput> = {}): StartCheckInCallInput {
  return {
    name: "Margaret",
    phone: "+14155551234",
    dayPostOp: 4,
    lastCheckinSummary: "Yesterday you rated your pain 7 out of 10.",
    ...partial,
  };
}

/** A fetch fake — startCheckInCall must never make a real network call in
 * tests (constraint: no real network calls in tests). */
function fakeFetch(handler: (url: string, init: RequestInit) => Response): CallFetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    return handler(String(input), init ?? {});
  }) as CallFetch;
}

describe("startCheckInCall", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("returns a typed skipped result and warns naming the missing var when no credentials are set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startCheckInCall } = await freshCallModule();

    const result = await startCheckInCall(basePatient());

    expect(result.status).toBe("skipped");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_AGENT_PHONE_NUMBER_ID"),
    );
    warn.mockRestore();
  });

  it("names only the specific missing var when the others are present", async () => {
    process.env.ELEVENLABS_API_KEY = "test-xi-key";
    process.env.ELEVENLABS_AGENT_ID = "agent-123";
    // ELEVENLABS_AGENT_PHONE_NUMBER_ID intentionally left unset.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startCheckInCall } = await freshCallModule();

    await startCheckInCall(basePatient());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ELEVENLABS_AGENT_PHONE_NUMBER_ID"));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("ELEVENLABS_API_KEY not set"));
    warn.mockRestore();
  });

  it("never throws, and never calls fetch, when credentials are absent", async () => {
    const { startCheckInCall } = await freshCallModule();
    const fetchSpy = vi.fn();

    await expect(startCheckInCall(basePatient(), fetchSpy as unknown as CallFetch)).resolves.not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-E.164 phone number as a typed error without calling fetch", async () => {
    setAllCredentials();
    const { startCheckInCall } = await freshCallModule();
    const fetchSpy = vi.fn();

    const result = await startCheckInCall(
      basePatient({ phone: "415-555-1234" }),
      fetchSpy as unknown as CallFetch,
    );

    expect(result).toEqual({ status: "error", reason: expect.stringContaining("E.164") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the exact ElevenLabs outbound-call payload with xi-api-key header", async () => {
    setAllCredentials();
    const { startCheckInCall } = await freshCallModule();

    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const fetchImpl = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ conversation_id: "conv_1" }), { status: 200 });
    });

    const result = await startCheckInCall(basePatient(), fetchImpl);

    expect(capturedUrl).toBe("https://api.elevenlabs.io/v1/convai/twilio/outbound-call");
    expect(capturedInit.method).toBe("POST");
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("test-xi-key");

    const body = JSON.parse(capturedInit.body as string);
    expect(body).toEqual({
      agent_id: "agent-123",
      agent_phone_number_id: "phone-456",
      to_number: "+14155551234",
      conversation_initiation_client_data: {
        dynamic_variables: {
          patient_name: "Margaret",
          day_post_op: 4,
          last_checkin_summary: "Yesterday you rated your pain 7 out of 10.",
        },
      },
    });

    expect(result).toEqual({ status: "sent", conversationId: "conv_1" });
  });

  it("defaults last_checkin_summary to an empty string when not provided", async () => {
    setAllCredentials();
    const { startCheckInCall } = await freshCallModule();

    let capturedBody = "";
    const fetchImpl = fakeFetch((_url, init) => {
      capturedBody = init.body as string;
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await startCheckInCall(basePatient({ lastCheckinSummary: undefined }), fetchImpl);

    const body = JSON.parse(capturedBody);
    expect(body.conversation_initiation_client_data.dynamic_variables.last_checkin_summary).toBe("");
  });

  it("returns a typed error result (not a throw) on a non-2xx response", async () => {
    setAllCredentials();
    const { startCheckInCall } = await freshCallModule();

    const fetchImpl = fakeFetch(() => new Response("bad agent id", { status: 422 }));

    const result = await startCheckInCall(basePatient(), fetchImpl);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toContain("422");
    }
  });

  it("returns a typed error result (not a throw) when fetch itself rejects", async () => {
    setAllCredentials();
    const { startCheckInCall } = await freshCallModule();

    const fetchImpl: CallFetch = (async () => {
      throw new Error("network down");
    }) as unknown as CallFetch;

    const result = await startCheckInCall(basePatient(), fetchImpl);
    expect(result).toEqual({ status: "error", reason: "network down" });
  });
});
