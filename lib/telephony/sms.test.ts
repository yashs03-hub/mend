import { afterEach, describe, expect, it, vi } from "vitest";
import type { Decision } from "../clinical/types";
import type { TwilioClientFactory, TwilioMessageClient } from "./sms";

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "DEMO_CAREGIVER_PHONE",
] as const;

async function freshSmsModule() {
  vi.resetModules();
  return import("./sms");
}

function setAllCredentials() {
  process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
  process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
  process.env.TWILIO_FROM_NUMBER = "+15005550006";
  process.env.DEMO_CAREGIVER_PHONE = "+14155559999";
}

function decision(partial: Partial<Decision> = {}): Decision {
  return {
    level: "amber",
    action: "Contact the surgeon's office today.",
    rationale: ["Calf pain or swelling reported."],
    firedRules: ["dvt.calf_pain_or_swelling"],
    ...partial,
  };
}

/** Fake Twilio client factory — notifyCaregiver must never construct a real
 * Twilio client or make a real network call in tests. */
function fakeClientFactory(create: TwilioMessageClient["messages"]["create"]): TwilioClientFactory {
  return () => ({ messages: { create } });
}

describe("buildCaregiverMessage", () => {
  it("includes the condition, action, and SBAR", async () => {
    const { buildCaregiverMessage } = await freshSmsModule();
    const message = buildCaregiverMessage(
      "Margaret",
      decision({ condition: "Possible DVT" }),
      "S: stable. B: POD5. A: amber. R: contact surgeon.",
    );

    expect(message).toContain("Possible DVT");
    expect(message).toContain("Contact the surgeon's office today.");
    expect(message).toContain("S: stable. B: POD5. A: amber. R: contact surgeon.");
  });

  it("truncates to 1500 characters", async () => {
    const { buildCaregiverMessage } = await freshSmsModule();
    const longSbar = "x".repeat(3000);
    const message = buildCaregiverMessage("Margaret", decision(), longSbar);
    expect(message.length).toBe(1500);
  });
});

describe("notifyCaregiver", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("never sends on a green decision, and does not even inspect credentials", async () => {
    const { notifyCaregiver } = await freshSmsModule();
    const create = vi.fn();

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "+14155559999" },
      decision({ level: "green", condition: undefined, action: "Continue the current recovery plan." }),
      "S: stable.",
      fakeClientFactory(create),
    );

    expect(result).toEqual({
      status: "skipped",
      reason: expect.stringContaining("green"),
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a typed skipped result and warns naming exactly the missing vars when unconfigured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { notifyCaregiver } = await freshSmsModule();
    const create = vi.fn();

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: undefined },
      decision(),
      "S: stable.",
      fakeClientFactory(create),
    );

    expect(result.status).toBe("skipped");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DEMO_CAREGIVER_PHONE",
      ),
    );
    expect(create).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fires for amber, sending to patient.caregiverPhone", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();

    let captured: { to: string; from: string; body: string } | undefined;
    const create = vi.fn(async (args: { to: string; from: string; body: string }) => {
      captured = args;
      return { sid: "SM_amber_1" };
    });

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "+14155551234" },
      decision({ level: "amber", condition: "Possible DVT" }),
      "S: stable. B: POD5.",
      fakeClientFactory(create),
    );

    expect(result).toEqual({ status: "sent", sid: "SM_amber_1" });
    expect(captured?.to).toBe("+14155551234");
    expect(captured?.from).toBe("+15005550006");
    expect(captured?.body).toContain("Possible DVT");
  });

  it("fires for red", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();
    const create = vi.fn(async () => ({ sid: "SM_red_1" }));

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "+14155551234" },
      decision({ level: "red", condition: "Suspected hip dislocation", action: "Call 911 now." }),
      "S: unstable.",
      fakeClientFactory(create),
    );

    expect(result).toEqual({ status: "sent", sid: "SM_red_1" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("falls back to DEMO_CAREGIVER_PHONE when patient.caregiverPhone is absent", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();

    let captured: { to: string } | undefined;
    const create = vi.fn(async (args: { to: string }) => {
      captured = args;
      return { sid: "SM_fallback_1" };
    });

    await notifyCaregiver({ name: "Margaret", caregiverPhone: undefined }, decision(), "S: stable.", fakeClientFactory(create));

    expect(captured?.to).toBe("+14155559999");
  });

  it("returns a typed error, not a throw, for an invalid E.164 caregiver number", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();
    const create = vi.fn();

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "not-a-phone-number" },
      decision(),
      "S: stable.",
      fakeClientFactory(create),
    );

    expect(result).toEqual({ status: "error", reason: expect.stringContaining("E.164") });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a typed error, not a throw, when the Twilio client rejects", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();
    const create = vi.fn(async () => {
      throw new Error("Twilio 21211: invalid to number");
    });

    const result = await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "+14155551234" },
      decision(),
      "S: stable.",
      fakeClientFactory(create),
    );

    expect(result).toEqual({ status: "error", reason: "Twilio 21211: invalid to number" });
  });

  it("never logs the full caregiver phone number on any path", async () => {
    setAllCredentials();
    const { notifyCaregiver } = await freshSmsModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(async () => {
      throw new Error("boom");
    });

    await notifyCaregiver(
      { name: "Margaret", caregiverPhone: "+14155551234" },
      decision(),
      "S: stable.",
      fakeClientFactory(create),
    );

    for (const call of warn.mock.calls) {
      const joined = call.map((arg) => String(arg)).join(" ");
      expect(joined).not.toContain("4155551234");
    }
    warn.mockRestore();
  });
});
