/**
 * Formatting for the clinician surfaces.
 *
 * Everything here renders on the server and is never re-rendered on the
 * client, so a wall-clock value cannot drift between the two. Locale is
 * pinned to en-US (Market = United States) with a 24-hour clock throughout:
 * a nurse line reads "08:12", not "8:12 AM", and month-first dates match
 * what a US clinician expects on a projector.
 */

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
});

const DATE_FULL = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function clockTime(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : TIME.format(ms);
}

export function shortDate(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : DATE.format(ms);
}

export function fullDate(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : DATE_FULL.format(ms);
}

/**
 * How long ago, in the units a worklist is scanned in. Under an hour reads in
 * minutes, under a day in hours and minutes, beyond that in days — a nurse
 * deciding who to call next never needs "1.4 days".
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";

  const elapsed = now.getTime() - ms;
  if (elapsed < 0) return "just now";
  if (elapsed < MS_PER_MINUTE) return "just now";

  if (elapsed < MS_PER_HOUR) {
    return `${Math.floor(elapsed / MS_PER_MINUTE)} min ago`;
  }

  if (elapsed < MS_PER_DAY) {
    const hours = Math.floor(elapsed / MS_PER_HOUR);
    const minutes = Math.floor((elapsed % MS_PER_HOUR) / MS_PER_MINUTE);
    return minutes === 0 ? `${hours} hr ago` : `${hours} hr ${minutes} min ago`;
  }

  const days = Math.floor(elapsed / MS_PER_DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Call length, as "3 min 34 s". */
export function callLength(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes === 0 ? `${rest} s` : `${minutes} min ${rest} s`;
}

/** A signed number with its unit, for slopes and deltas. */
export function signed(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
