/**
 * Global keyboard shortcut for the demo console: Ctrl/⌘ + Shift + M.
 *
 * Chosen because it is mnemonic (Mend), rarely bound by browsers outside
 * DevTools device mode (which only applies when DevTools itself is focused),
 * and easy to announce on stage. Must not fire while the operator is typing.
 */

export const CONSOLE_SHORTCUT_LABEL = "Ctrl/⌘⇧M";

/** Duck-typed so unit tests can exercise it under Vitest's node environment. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") {
    return false;
  }
  const node = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };
  if (node.isContentEditable === true) {
    return true;
  }
  const tag = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Pure predicate over a KeyboardEvent-like shape — unit-testable without DOM. */
export function matchesConsoleShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (isTypingTarget(event.target)) {
    return false;
  }
  if (event.altKey) {
    return false;
  }
  if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) {
    return false;
  }
  return event.key.toLowerCase() === "m";
}
