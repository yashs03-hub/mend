import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SMS-sent fact must land in `escalations.notified_caregiver_at` even
 * when the surrounding vitals/checkin persistence fails. Suppressing the
 * SMS is never the answer — the audit row is.
 */

const insertEscalation = vi.fn().mockResolvedValue("esc-early-1");
const insertCheckin = vi.fn().mockRejectedValue(new Error("checkins insert failed"));
const insertVitals = vi.fn().mockRejectedValue(new Error("vitals insert failed"));
const linkEscalationCheckin = vi.fn().mockResolvedValue(true);

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
  linkEscalationCheckin,
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
    insertEscalation.mockReset().mockResolvedValue("esc-early-1");
    insertCheckin.mockReset().mockRejectedValue(new Error("checkins insert failed"));
    insertVitals.mockReset().mockRejectedValue(new Error("vitals insert failed"));
    linkEscalationCheckin.mockReset().mockResolvedValue(true);
    notifyCaregiver.mockClear();
    vi.resetModules();
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
        checkin_id: null,
      }),
    );
    // The durable write happens before (and despite) the failed checkin path.
    expect(insertEscalation.mock.invocationCallOrder[0]).toBeLessThan(
      insertCheckin.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    // No check-in id to attach — do not invent a second escalation row.
    expect(linkEscalationCheckin).not.toHaveBeenCalled();
  });

  it("links the early SMS audit row to the check-in after insertCheckin succeeds", async () => {
    insertVitals.mockResolvedValue(undefined);
    insertCheckin.mockResolvedValue("checkin-99");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    expect(insertEscalation).toHaveBeenCalledTimes(1);
    expect(linkEscalationCheckin).toHaveBeenCalledWith(expect.anything(), "esc-early-1", "checkin-99");
    // Link-back is after the check-in write, never before the durable SMS audit.
    expect(insertEscalation.mock.invocationCallOrder[0]).toBeLessThan(
      insertCheckin.mock.invocationCallOrder[0]!,
    );
    expect(insertCheckin.mock.invocationCallOrder[0]).toBeLessThan(
      linkEscalationCheckin.mock.invocationCallOrder[0]!,
    );
  });

  it("falls back to a full escalation insert when the early audit row was not recorded", async () => {
    insertEscalation.mockResolvedValueOnce(undefined).mockResolvedValueOnce("esc-fallback-1");
    insertVitals.mockResolvedValue(undefined);
    insertCheckin.mockResolvedValue("checkin-55");

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    expect(insertEscalation).toHaveBeenCalledTimes(2);
    expect(insertEscalation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        patient_id: "patient-1",
        checkin_id: "checkin-55",
        level: "amber",
        notified_caregiver_at: expect.any(String),
      }),
    );
    expect(linkEscalationCheckin).not.toHaveBeenCalled();
  });

  it("warns when link-back returns false after insertCheckin succeeds", async () => {
    insertVitals.mockResolvedValue(undefined);
    insertCheckin.mockResolvedValue("checkin-99");
    linkEscalationCheckin.mockResolvedValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    expect(notifyCaregiver).toHaveBeenCalledTimes(1);
    expect(linkEscalationCheckin).toHaveBeenCalledWith(expect.anything(), "esc-early-1", "checkin-99");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("failed to link escalation to checkin"),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it("warns when the early SMS audit insert returns no id after a successful send", async () => {
    insertEscalation.mockResolvedValue(undefined);
    insertVitals.mockResolvedValue(undefined);
    insertCheckin.mockResolvedValue("checkin-55");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    expect(notifyCaregiver).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("failed to durable-record caregiver notification"),
      expect.anything(),
    );
    warn.mockRestore();
  });
});
