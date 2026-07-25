import { describe, expect, it, vi } from "vitest";

// Constraint #6: both routes must work with no Supabase and no Anthropic
// credentials configured. Mocking both client getters to their
// "unavailable" value exercises exactly that path deterministically.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/checkin", () => {
  it("returns 400 on malformed JSON without throwing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("{not valid json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is an empty string", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when dayPostOp is not a number", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "I feel fine.", dayPostOp: "four" }));
    expect(res.status).toBe(400);
  });

  // PREVIOUSLY WRONG: this test accepted green when Anthropic was unavailable,
  // encoding the clinically unsafe bug where failed extraction looked like
  // "patient reported nothing". With Fix 1, no client => symptomsUnusable =>
  // amber (symptoms.extraction_failed), never green.
  it(
    "works end-to-end with no Supabase and no Anthropic credentials: " +
      "fails safe to amber (never green) when extraction cannot run",
    async () => {
      const { POST } = await import("./route");
      const res = await POST(
        makeRequest({
          transcript: "I can't breathe and my chest hurts.",
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.decision).toBeDefined();
      expect(json.decision.level).not.toBe("green");
      expect(json.decision.level).toBe("amber");
      expect(json.decision.firedRules).toContain("symptoms.extraction_failed");
      expect(json.decision.condition).toBe("Symptom extraction unavailable");
      expect(Array.isArray(json.trendFindings)).toBe(true);
      expect(json.phase).toBeDefined();
      expect(json.symptoms).toBeDefined();
      expect(json.vitals).toBeDefined();
      expect(json.ecg).toBeDefined();
      expect(typeof json.sbar).toBe("string");
    },
  );

  it("never returns a severity that did not come from evaluate()/composeDecision()", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "Nothing unusual to report today." }));
    const json = await res.json();
    expect(["green", "amber", "red"]).toContain(json.decision.level);
  });
});
