import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// This route must work fully with no Supabase credentials configured
// (constraint #6) — mocking the client getter makes that the exercised
// path deterministically, regardless of what a developer's local shell
// environment happens to have set.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

const SECRET = "test-triage-secret-9f3a";
const HEADER = "x-triage-webhook-secret";

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/triage", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/triage", () => {
  beforeEach(() => {
    vi.stubEnv("TRIAGE_WEBHOOK_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("auth", () => {
    it("returns 401 when the secret header is missing", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(typeof json.script).toBe("string");
      expect(json.script.length).toBeGreaterThan(0);
    });

    it("returns 401 when the secret header is wrong", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: "definitely-wrong" }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.script).toMatch(/care team|nurse line|911/i);
    });

    it("returns 401 when the secret header has the right length but wrong content", async () => {
      const { POST } = await import("./route");
      const wrongSameLength = "x".repeat(SECRET.length);
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: wrongSameLength }));
      expect(res.status).toBe(401);
      expect((await res.json()).script).toBeTruthy();
    });

    it("returns 401 when TRIAGE_WEBHOOK_SECRET is not configured at all (fail closed)", async () => {
      vi.unstubAllEnvs();
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: SECRET }));
      expect(res.status).toBe(401);
      expect((await res.json()).script).toBeTruthy();
    });

    it("accepts the request when the header exactly matches the secret", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: SECRET }));
      expect(res.status).toBe(200);
    });
  });

  describe("malformed bodies never throw", () => {
    it("returns 400 on invalid JSON", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest("{not valid json", { [HEADER]: SECRET }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Malformed JSON/i);
      expect(typeof json.script).toBe("string");
      expect(json.script).toMatch(/care team|nurse line|911/i);
      expect(json.script).not.toMatch(/\bNHS\b|A&E|999/);
      expect(json.severity).toBeUndefined();
    });

    it("returns 400 when symptoms is missing", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({}, { [HEADER]: SECRET }));
      expect(res.status).toBe(400);
      expect((await res.json()).script).toBeTruthy();
    });

    it("returns 400 when symptoms is not an object", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: "breathless" }, { [HEADER]: SECRET }));
      expect(res.status).toBe(400);
      expect((await res.json()).script).toBeTruthy();
    });

    it("returns 400 when dayPostOp is not a number", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        makeRequest({ symptoms: {}, dayPostOp: "four" }, { [HEADER]: SECRET }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).script).toBeTruthy();
    });

    it("returns 400 for a top-level array body", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest([1, 2, 3], { [HEADER]: SECRET }));
      expect(res.status).toBe(400);
      expect((await res.json()).script).toBeTruthy();
    });
  });

  describe("error scripts are speakable and non-clinical", () => {
    it("every 401/400 path returns the same conservative script shape", async () => {
      const { POST } = await import("./route");
      const cases: Array<{ status: number; req: Request }> = [
        { status: 401, req: makeRequest({ symptoms: {} }) },
        {
          status: 400,
          req: makeRequest("{not valid json", { [HEADER]: SECRET }),
        },
        {
          status: 400,
          req: makeRequest({}, { [HEADER]: SECRET }),
        },
      ];

      const scripts: string[] = [];
      for (const c of cases) {
        const res = await POST(c.req);
        expect(res.status).toBe(c.status);
        const json = await res.json();
        expect(typeof json.script).toBe("string");
        expect(json.script.length).toBeGreaterThan(40);
        expect(json.script).not.toMatch(/pulmonary embolism|dislocation|sepsis/i);
        scripts.push(json.script);
      }
      expect(new Set(scripts).size).toBe(1);
    });
  });

  describe("deterministic severity and script", () => {
    it("red symptoms (hip dislocation triad, vitals-independent) yield red severity and a script containing 911", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        makeRequest(
          {
            symptoms: {
              suddenSevereHipPain: true,
              legShortenedOrRotated: true,
              unableToWeightBear: true,
            },
          },
          { [HEADER]: SECRET },
        ),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.severity).toBe("red");
      expect(json.condition).toBe("Suspected hip dislocation");
      expect(json.script).toContain("911");
      expect(typeof json.reason).toBe("string");
      expect(json.reason.length).toBeGreaterThan(0);
    });

    it("green symptoms yield a reassuring script with no 911", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        makeRequest({ symptoms: { painControlled: true } }, { [HEADER]: SECRET }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.severity).toBe("green");
      expect(json.condition).toBeUndefined();
      expect(json.script).not.toContain("911");
      expect(json.script.toLowerCase()).toContain("looks good");
    });

    it("only ever returns a severity produced by evaluate() — never invents red/amber from thin air", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: SECRET }));
      const json = await res.json();
      expect(["green", "amber", "red"]).toContain(json.severity);
    });

    it("defaults dayPostOp when omitted and still returns a valid response", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ symptoms: {} }, { [HEADER]: SECRET }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.reason).toContain("Day 4");
    });
  });

  describe("latency", () => {
    it("responds well under 3 seconds when Supabase is unavailable", async () => {
      const { POST } = await import("./route");
      const start = Date.now();
      await POST(makeRequest({ symptoms: {} }, { [HEADER]: SECRET }));
      expect(Date.now() - start).toBeLessThan(3000);
    });
  });
});
