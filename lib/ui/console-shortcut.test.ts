import { describe, expect, it } from "vitest";
import { isTypingTarget, matchesConsoleShortcut } from "./console-shortcut";

function target(tagName: string, isContentEditable = false): EventTarget {
  return { tagName, isContentEditable } as unknown as EventTarget;
}

describe("console shortcut matching", () => {
  it("matches Ctrl+Shift+M outside editable fields", () => {
    expect(
      matchesConsoleShortcut({
        key: "m",
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        target: target("DIV"),
      }),
    ).toBe(true);
  });

  it("matches Meta+Shift+M (macOS)", () => {
    expect(
      matchesConsoleShortcut({
        key: "M",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        target: null,
      }),
    ).toBe(true);
  });

  it("does not fire while focus is in an input", () => {
    expect(
      matchesConsoleShortcut({
        key: "m",
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        target: target("INPUT"),
      }),
    ).toBe(false);
  });

  it("does not fire without the modifier chord", () => {
    expect(
      matchesConsoleShortcut({
        key: "m",
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        target: target("DIV"),
      }),
    ).toBe(false);
  });

  it("isTypingTarget covers textarea and contenteditable", () => {
    expect(isTypingTarget(target("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(target("DIV", true))).toBe(true);
    expect(isTypingTarget(target("DIV"))).toBe(false);
  });
});
