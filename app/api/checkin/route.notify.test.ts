import { describe, expect, it, vi } from "vitest";

/**
 * Focused integration coverage for the notifyCaregiver wiring added to the
 * /api/checkin escalation path (Task 13). Kept in a separate file from
 * route.test.ts so mocking `evaluate()` and `notifyCaregiver` here can't
 * change the behavior asserted by the unmocked tests in that file.
 */
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

const notifyCaregiver = vi.fn().mockResolvedValue({ status: "sent", sid: "SM_test" });
vi.mock("@/lib/telephony/sms", () => ({ notifyCaregiver }));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkin — notifyCaregiver wiring", () => {
  it("does NOT call notifyCaregiver on a green decision", async () => {
    vi.doMock("@/lib/clinical/red-flag-engine", () => ({
      evaluate: () => ({
        level: "green",
        action: "Continue the current recovery plan.",
        rationale: ["Day 4 vitals and symptoms are within the expected recovery envelope."],
        firedRules: [],
      }),
    }));
    vi.resetModules();
    notifyCaregiver.mockClear();

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "Everything is fine today." }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.decision.level).toBe("green");
    expect(notifyCaregiver).not.toHaveBeenCalled();

    vi.doUnmock("@/lib/clinical/red-flag-engine");
  });

  it("calls notifyCaregiver with the composed decision and SBAR on an amber decision", async () => {
    vi.doMock("@/lib/clinical/red-flag-engine", () => ({
      evaluate: () => ({
        level: "amber",
        condition: "Possible DVT",
        action: "Contact the surgeon's office today for an urgent DVT assessment.",
        call: "surgeon_office",
        rationale: ["Calf pain or swelling reported, a possible sign of deep vein thrombosis."],
        firedRules: ["dvt.calf_pain_or_swelling"],
      }),
    }));
    vi.resetModules();
    notifyCaregiver.mockClear();

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.decision.level).toBe("amber");
    expect(notifyCaregiver).toHaveBeenCalledTimes(1);

    const [patientArg, decisionArg, sbarArg] = notifyCaregiver.mock.calls[0]!;
    expect((decisionArg as { level: string }).level).toBe("amber");
    expect((decisionArg as { condition?: string }).condition).toBe("Possible DVT");
    expect(typeof sbarArg).toBe("string");
    expect(patientArg).toHaveProperty("name");

    vi.doUnmock("@/lib/clinical/red-flag-engine");
  });

  it("calls notifyCaregiver on a red decision", async () => {
    vi.doMock("@/lib/clinical/red-flag-engine", () => ({
      evaluate: () => ({
        level: "red",
        condition: "Suspected hip dislocation",
        action: "Call 911 now. Do not attempt to bear weight on the operated leg.",
        call: "911",
        rationale: ["Classic hip dislocation signs reported."],
        firedRules: ["dislocation.classic_triad"],
      }),
    }));
    vi.resetModules();
    notifyCaregiver.mockClear();

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My leg looks shorter and I can't stand on it." }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.decision.level).toBe("red");
    expect(notifyCaregiver).toHaveBeenCalledTimes(1);

    vi.doUnmock("@/lib/clinical/red-flag-engine");
  });
});
