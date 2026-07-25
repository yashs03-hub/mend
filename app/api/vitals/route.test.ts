import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const fetchDemoPatientMock = vi.fn();

// Same posture as app/api/triage/route.test.ts and app/api/ecg's implicit
// contract: this route must degrade gracefully with no Supabase credentials
// (lib/db/supabase.ts's `getSupabaseClient` returns null), and the "happy
// path" persistence must be exercised without a real database.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  fetchDemoPatient: (...args: unknown[]) => fetchDemoPatientMock(...args),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_READING = {
  timestamp: "2026-07-25T12:00:00.000Z",
  hr: 118,
  source: "ble_heart_rate",
  deviceLabel: "Wahoo TICKR",
  quality: "ok",
};

describe("POST /api/vitals", () => {
  beforeEach(async () => {
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    fetchDemoPatientMock.mockReset().mockResolvedValue({ id: "demo-patient-id" });
    const { getSupabaseClient } = await import("@/lib/db/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("malformed / invalid bodies never throw", () => {
    it("returns 400 on invalid JSON", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest("{not valid json"));
      expect(res.status).toBe(400);
    });

    it("returns 400 for a top-level array body", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest([1, 2, 3]));
      expect(res.status).toBe(400);
    });

    it("returns 400 when source is missing", async () => {
      const { POST } = await import("./route");
      const { source: _source, ...withoutSource } = VALID_READING;
      const res = await POST(makeRequest(withoutSource));
      expect(res.status).toBe(400);
    });

    it("returns 400 when source is not one of the known VitalsSource values", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, source: "apple_watch" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when quality is not one of ok/poor/stale", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, quality: "great" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when hr is a string instead of a number", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, hr: "118" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when timestamp is missing", async () => {
      const { POST } = await import("./route");
      const { timestamp: _timestamp, ...withoutTimestamp } = VALID_READING;
      const res = await POST(makeRequest(withoutTimestamp));
      expect(res.status).toBe(400);
    });

    it("returns 400 when timestamp is not a parseable date", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, timestamp: "not-a-date" }));
      expect(res.status).toBe(400);
    });

    it("includes Zod issues in the 400 response body", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, quality: "great" }));
      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(Array.isArray(json.issues)).toBe(true);
      expect(json.issues.length).toBeGreaterThan(0);
    });
  });

  describe("no Supabase credentials configured", () => {
    it("returns 200 with persisted: false and echoes the validated reading", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest(VALID_READING));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(false);
      expect(json.reading).toEqual(VALID_READING);
    });
  });

  describe("with a Supabase client available", () => {
    beforeEach(async () => {
      const { getSupabaseClient } = await import("@/lib/db/supabase");
      vi.mocked(getSupabaseClient).mockReturnValue({ from: fromMock } as never);
    });

    it("persists using the resolved demo patient when no patientId is supplied", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest(VALID_READING));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(true);
      expect(fromMock).toHaveBeenCalledWith("vitals");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: "demo-patient-id",
          recorded_at: VALID_READING.timestamp,
          hr: 118,
          pain_score: null,
          source: "ble_heart_rate",
          device_label: "Wahoo TICKR",
          quality: "ok",
        }),
      );
    });

    it("uses an explicit patientId over the resolved demo patient", async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ ...VALID_READING, patientId: "explicit-id" }));

      expect(res.status).toBe(200);
      expect(fetchDemoPatientMock).not.toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ patient_id: "explicit-id" }),
      );
    });

    it("nulls out omitted optional physiologic fields rather than dropping the column", async () => {
      const { POST } = await import("./route");
      await POST(
        makeRequest({
          timestamp: VALID_READING.timestamp,
          hr: 118,
          source: "ble_heart_rate",
          quality: "ok",
        }),
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sbp: null,
          dbp: null,
          temp_c: null,
          spo2: null,
          resp_rate: null,
          device_label: null,
        }),
      );
    });

    it("returns persisted: false when no patient id is available at all", async () => {
      fetchDemoPatientMock.mockResolvedValue(undefined);
      const { POST } = await import("./route");
      const res = await POST(makeRequest(VALID_READING));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("returns persisted: false (not an error) when the insert itself fails", async () => {
      insertMock.mockResolvedValue({ error: { message: "connection reset" } });
      const { POST } = await import("./route");
      const res = await POST(makeRequest(VALID_READING));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.persisted).toBe(false);
    });
  });
});
