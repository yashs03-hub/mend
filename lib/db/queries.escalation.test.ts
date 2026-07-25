import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EscalationInsert } from "./supabase";
import { insertEscalation, linkEscalationCheckin } from "./queries";
import { planEscalationAfterCheckin } from "./escalation-audit";

function mockClientForInsertReturningId(id: string) {
  const single = vi.fn().mockResolvedValue({ data: { id }, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    insert,
    select,
    single,
  };
}

function mockClientForUpdateEq() {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    update,
    eq,
  };
}

const sampleInsert: EscalationInsert = {
  patient_id: "patient-1",
  checkin_id: null,
  level: "amber",
  condition: "Possible DVT",
  notified_caregiver_at: "2026-07-25T12:00:00.000Z",
};

describe("insertEscalation", () => {
  it("returns the inserted escalation row id", async () => {
    const { client, from, insert, select, single } = mockClientForInsertReturningId("esc-42");

    const id = await insertEscalation(client, sampleInsert);

    expect(from).toHaveBeenCalledWith("escalations");
    expect(insert).toHaveBeenCalledWith(sampleInsert);
    expect(select).toHaveBeenCalledWith("id");
    expect(single).toHaveBeenCalled();
    expect(id).toBe("esc-42");
  });
});

describe("linkEscalationCheckin", () => {
  it("patches checkin_id on the early escalation row and returns true", async () => {
    const { client, from, update, eq } = mockClientForUpdateEq();

    const ok = await linkEscalationCheckin(client, "esc-42", "checkin-7");

    expect(from).toHaveBeenCalledWith("escalations");
    expect(update).toHaveBeenCalledWith({ checkin_id: "checkin-7" });
    expect(eq).toHaveBeenCalledWith("id", "esc-42");
    expect(ok).toBe(true);
  });

  it("returns false when the update reports a Supabase error", async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: { message: "update failed" } });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as SupabaseClient<Database>;

    await expect(linkEscalationCheckin(client, "esc-42", "checkin-7")).resolves.toBe(false);
  });

  it("returns false when the update times out or throws (withTimeout soft-fail)", async () => {
    const eq = vi.fn().mockRejectedValue(new Error("network down"));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as SupabaseClient<Database>;

    await expect(linkEscalationCheckin(client, "esc-42", "checkin-7")).resolves.toBe(false);
  });
});

describe("planEscalationAfterCheckin", () => {
  it("links when an early SMS audit row and check-in id both exist", () => {
    expect(
      planEscalationAfterCheckin({
        level: "amber",
        earlyEscalationId: "esc-42",
        checkinId: "checkin-7",
      }),
    ).toEqual({ kind: "link", escalationId: "esc-42", checkinId: "checkin-7" });
  });

  it("falls back to insert when there was no early row", () => {
    expect(
      planEscalationAfterCheckin({
        level: "red",
        earlyEscalationId: undefined,
        checkinId: "checkin-7",
      }),
    ).toEqual({ kind: "insert_fallback" });
  });

  it("is a noop on green decisions", () => {
    expect(
      planEscalationAfterCheckin({
        level: "green",
        earlyEscalationId: undefined,
        checkinId: "checkin-7",
      }),
    ).toEqual({ kind: "noop" });
  });
});
