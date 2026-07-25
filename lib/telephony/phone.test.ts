import { describe, expect, it } from "vitest";
import { isE164, maskPhone } from "./phone";

describe("isE164", () => {
  it("accepts valid E.164 numbers", () => {
    expect(isE164("+14155551234")).toBe(true);
    expect(isE164("+442071838750")).toBe(true);
    expect(isE164("+911234567890")).toBe(true);
  });

  it("rejects numbers missing the leading +", () => {
    expect(isE164("14155551234")).toBe(false);
  });

  it("rejects numbers with a leading zero after the +", () => {
    expect(isE164("+0123456789")).toBe(false);
  });

  it("rejects numbers with spaces, dashes, or parens", () => {
    expect(isE164("+1 415 555 1234")).toBe(false);
    expect(isE164("+1-415-555-1234")).toBe(false);
    expect(isE164("+1(415)5551234")).toBe(false);
  });

  it("rejects empty strings, undefined, and null", () => {
    expect(isE164("")).toBe(false);
    expect(isE164(undefined)).toBe(false);
    expect(isE164(null)).toBe(false);
  });

  it("rejects numbers longer than 15 digits", () => {
    expect(isE164("+1234567890123456")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("never returns the original number for a realistic phone number", () => {
    const masked = maskPhone("+14155551234");
    expect(masked).not.toBe("+14155551234");
    expect(masked).not.toContain("4155551");
  });

  it("keeps a short recognizable prefix and suffix", () => {
    const masked = maskPhone("+14155551234");
    expect(masked.startsWith("+14")).toBe(true);
    expect(masked.endsWith("34")).toBe(true);
    expect(masked).toContain("*");
  });

  it("fully masks very short strings without throwing", () => {
    expect(() => maskPhone("123")).not.toThrow();
    expect(maskPhone("123")).toBe("***");
  });

  it("fully masks an empty string without throwing", () => {
    expect(maskPhone("")).toBe("");
  });
});
