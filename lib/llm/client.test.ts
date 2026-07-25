import { afterEach, describe, expect, it, vi } from "vitest";

async function freshClientModule() {
  vi.resetModules();
  return import("./client");
}

describe("getAnthropicModel", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_MODEL;
  });

  it("defaults to DEFAULT_ANTHROPIC_MODEL when unset", async () => {
    const { getAnthropicModel, DEFAULT_ANTHROPIC_MODEL } = await freshClientModule();
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("reads an override from ANTHROPIC_MODEL", async () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-5";
    const { getAnthropicModel } = await freshClientModule();
    expect(getAnthropicModel()).toBe("claude-opus-5");
  });

  it("ignores a blank ANTHROPIC_MODEL and falls back to the default", async () => {
    process.env.ANTHROPIC_MODEL = "   ";
    const { getAnthropicModel, DEFAULT_ANTHROPIC_MODEL } = await freshClientModule();
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
  });
});

describe("createAnthropicClient", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns null and warns, never throws, when no API key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createAnthropicClient } = await freshClientModule();

    expect(() => createAnthropicClient()).not.toThrow();
    expect(createAnthropicClient()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ANTHROPIC_API_KEY is not set"));

    warn.mockRestore();
  });

  it("returns a client instance when an API key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const { createAnthropicClient } = await freshClientModule();
    expect(createAnthropicClient()).not.toBeNull();
  });
});
