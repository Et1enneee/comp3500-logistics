// Project-wide timezone convention: the database stores UTC; the UI and reports display and bucket by GMT+8.
export const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;
export const TIMEZONE_LABEL = "GMT+8";

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** UTC time -> "YYYY-MM-DD HH:mm:ss" in GMT+8. */
export function formatGmt8(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() + GMT8_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

/** UTC time -> "YYYY-MM-DD" in GMT+8. */
export function gmt8DateString(value: Date | string): string {
  return formatGmt8(value).slice(0, 10);
}

/** Today (calendar-day string) in GMT+8. */
export function todayGmt8(now: Date = new Date()): string {
  return gmt8DateString(now);
}

/** Strictly parses "YYYY-MM-DD"; returns null for invalid dates. */
export function parseDateString(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** The UTC instant corresponding to 00:00 of a GMT+8 calendar day. */
export function gmt8DayStartUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - GMT8_OFFSET_MS);
}

/** Adds n days to a GMT+8 calendar-day string and returns a new string. */
export function addDaysToDateString(value: string, days: number): string {
  const parsed = parseDateString(value);
  if (!parsed) return value;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export interface DateRange {
  from: string;
  to: string;
  /** The start day's 00:00:00 (GMT+8), expressed in UTC (inclusive). */
  startUtc: Date;
  /** The day after the end date's 00:00:00 (GMT+8), expressed in UTC (exclusive). */
  endUtc: Date;
}

/**
 * Parses from/to from the query (GMT+8 calendar days; start inclusive, end covering the whole day).
 * Defaults to the last 7 calendar days (including today). Invalid input returns an error message.
 */
export function resolveDateRange(
  fromRaw: string | null,
  toRaw: string | null,
  now: Date = new Date(),
): { ok: true; range: DateRange } | { ok: false; message: string } {
  const to = toRaw ? toRaw : todayGmt8(now);
  const from = fromRaw ? fromRaw : addDaysToDateString(to, -6);
  const fromParts = parseDateString(from);
  const toParts = parseDateString(to);
  if (!fromParts) return { ok: false, message: "The from date must be in YYYY-MM-DD format" };
  if (!toParts) return { ok: false, message: "The to date must be in YYYY-MM-DD format" };
  if (from > to) return { ok: false, message: "The from date cannot be after the to date" };
  const endExclusive = addDaysToDateString(to, 1);
  const endParts = parseDateString(endExclusive);
  if (!endParts) return { ok: false, message: "The date range is out of the processable range" };
  return {
    ok: true,
    range: {
      from,
      to,
      startUtc: gmt8DayStartUtc(fromParts.year, fromParts.month, fromParts.day),
      endUtc: gmt8DayStartUtc(endParts.year, endParts.month, endParts.day),
    },
  };
}

/** Yields every GMT+8 calendar day in the range: used to zero-fill the trend chart. */
export function eachDateInRange(from: string, to: string): string[] {
  if (!parseDateString(from) || !parseDateString(to) || from > to) return [];
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    if (current === to) break;
    const next = addDaysToDateString(current, 1);
    if (next === current) break;
    current = next;
  }
  return dates;
}
