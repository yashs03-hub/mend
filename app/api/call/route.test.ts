import { afterEach, describe, expect, it, vi } from "vitest";

// Constraint: this route must work with no Supabase and no ElevenLabs
// credentials configured, exactly like /api/checkin and /api/triage.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/call", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ENV_KEYS = [
  "DEMO_PATIENT_PHONE",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
] as const;

describe("POST /api/call", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("never throws on a missing body", async () => {
    const { POST } = await import("./route");
    await expect(POST(makeRequest())).resolves.not.toThrow();
  });

  it("never throws on malformed JSON", async () => {
    const { POST } = await import("./route");
    await expect(POST(makeRequest("{not valid json"))).resolves.not.toThrow();
  });

  it("returns 400 with no Supabase patient and no DEMO_PATIENT_PHONE — nothing to dial", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.status).toBe("error");
  });

  it("returns a typed skipped result (503) when a destination number exists but ElevenLabs credentials are absent", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("skipped");
  });

  it("accepts an explicit dayPostOp without throwing", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ dayPostOp: 10 }));
    expect(res.status).toBe(503);
  });

  it("echoes a valid clinician source in the response", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "clinician" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBe("clinician");
  });

  it("echoes a valid patient source in the response", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "patient" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBe("patient");
  });

  it("ignores an invalid source (treats as undefined)", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "nurse" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBeUndefined();
  });

  it("omits source when the body does not include one", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBeUndefined();
  });
});
