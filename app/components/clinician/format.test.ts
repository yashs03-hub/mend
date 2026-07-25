import { describe, expect, it } from "vitest";
import { callLength, clockTime, fullDate, shortDate, signed, timeAgo } from "./format";

const NOW = new Date("2026-07-25T12:00:00.000Z");
const minutesAgo = (n: number) =>
  new Date(NOW.getTime() - n * 60 * 1000).toISOString();

describe("timeAgo", () => {
  it("reads in minutes under an hour", () => {
    expect(timeAgo(minutesAgo(34), NOW)).toBe("34 min ago");
    expect(timeAgo(minutesAgo(59), NOW)).toBe("59 min ago");
  });

  it("reads in hours and minutes under a day", () => {
    expect(timeAgo(minutesAgo(60), NOW)).toBe("1 hr ago");
    expect(timeAgo(minutesAgo(131), NOW)).toBe("2 hr 11 min ago");
    expect(timeAgo(minutesAgo(402), NOW)).toBe("6 hr 42 min ago");
  });

  it("reads in whole days beyond that, and never in fractions", () => {
    expect(timeAgo(minutesAgo(60 * 24), NOW)).toBe("1 day ago");
    expect(timeAgo(minutesAgo(60 * 34), NOW)).toBe("1 day ago");
    expect(timeAgo(minutesAgo(60 * 24 * 9), NOW)).toBe("9 days ago");
  });

  it("collapses the last minute and any clock skew to 'just now'", () => {
    expect(timeAgo(minutesAgo(0.5), NOW)).toBe("just now");
    expect(timeAgo(minutesAgo(-5), NOW)).toBe("just now");
  });

  it("returns an em dash rather than NaN for an unparseable timestamp", () => {
    expect(timeAgo("not a date", NOW)).toBe("—");
    expect(clockTime("not a date")).toBe("—");
    expect(shortDate("not a date")).toBe("—");
  });
});

describe("clockTime", () => {
  it("uses a zero-padded 24-hour clock", () => {
    expect(clockTime("2026-07-25T08:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("shortDate / fullDate", () => {
  it("formats month-first in en-US", () => {
    // Fixed UTC noon avoids day-boundary drift across local timezones.
    expect(shortDate("2026-07-25T12:00:00.000Z")).toBe("Jul 25");
    expect(fullDate("2026-07-25T12:00:00.000Z")).toBe("Jul 25, 2026");
  });
});

describe("callLength", () => {
  it("formats under and over a minute", () => {
    expect(callLength(42)).toBe("42 s");
    expect(callLength(214)).toBe("3 min 34 s");
    expect(callLength(120)).toBe("2 min 0 s");
  });
});

describe("signed", () => {
  it("keeps the sign on a rising value and drops a trailing zero", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(0.21, 2)).toBe("+0.21");
    expect(signed(-1)).toBe("-1");
    expect(signed(0)).toBe("0");
  });
});
