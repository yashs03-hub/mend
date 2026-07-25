import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SMS-sent fact must land in `escalations.notified_caregiver_at` even
 * when the surrounding vitals/checkin persistence fails. Suppressing the
 * SMS is never the answer — the audit row is.
 */

const insertEscalation = vi.fn().mockResolvedValue(undefined);
const insertCheckin = vi.fn().mockRejectedValue(new Error("checkins insert failed"));
const insertVitals = vi.fn().mockRejectedValue(new Error("vitals insert failed"));

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({ from: () => ({}) }),
}));

vi.mock("@/lib/db/queries", () => ({
  fetchDemoPatient: async () => ({
    id: "patient-1",
    name: "Margaret (demo, synthetic)",
    procedure: "hip hemiarthroplasty",
    surgeryDate: "2026-07-21",
    phone: undefined,
    caregiverPhone: "+15551234567",
  }),
  fetchLatestEcg: async () => undefined,
  fetchLatestVitals: async () => undefined,
  fetchVitalsHistory: async () => [],
  insertCheckin,
  insertEscalation,
  insertVitals,
}));

const notifyCaregiver = vi.fn().mockResolvedValue({ status: "sent", sid: "SM_durable" });
vi.mock("@/lib/telephony/sms", () => ({ notifyCaregiver }));

vi.mock("@/lib/clinical/red-flag-engine", () => ({
  evaluate: () => ({
    level: "amber",
    condition: "Possible DVT",
    action: "Contact the surgeon's office today for an urgent DVT assessment.",
    call: "surgeon_office",
    rationale: ["Calf pain or swelling reported."],
    firedRules: ["dvt.calf_pain_or_swelling"],
  }),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkin — durable caregiver notification", () => {
  beforeEach(() => {
    insertEscalation.mockClear();
    insertCheckin.mockClear();
    insertVitals.mockClear();
    notifyCaregiver.mockClear();
  });

  it("records notified_caregiver_at even when vitals/checkin persistence fails", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    expect(notifyCaregiver).toHaveBeenCalledTimes(1);
    // SMS must still have been attempted — durability is about the audit
    // row, not about swallowing the send.
    expect(insertEscalation).toHaveBeenCalled();
    expect(insertEscalation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        patient_id: "patient-1",
        notified_caregiver_at: expect.any(String),
        level: "amber",
        condition: "Possible DVT",
      }),
    );
    // The durable write happens before (and despite) the failed checkin path.
    expect(insertEscalation.mock.invocationCallOrder[0]).toBeLessThan(
      insertCheckin.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });
});
