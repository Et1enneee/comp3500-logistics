import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  eachDateInRange,
  formatGmt8,
  gmt8DateString,
  gmt8DayStartUtc,
  parseDateString,
  resolveDateRange,
  todayGmt8,
} from "./time";

describe("GMT+8 time convention", () => {
  it("UTC 16:00 is 00:00 of the next day in GMT+8", () => {
    expect(formatGmt8("2026-03-01T16:00:00.000Z")).toBe("2026-03-02 00:00:00");
    expect(gmt8DateString("2026-03-01T15:59:59.999Z")).toBe("2026-03-01");
    expect(gmt8DateString("2026-03-01T16:00:00.000Z")).toBe("2026-03-02");
  });

  it("a calendar-day start converts to the UTC boundary", () => {
    expect(gmt8DayStartUtc(2026, 3, 1).toISOString()).toBe("2026-02-28T16:00:00.000Z");
  });

  it("parses dates strictly and rejects out-of-range values", () => {
    expect(parseDateString("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseDateString("2026-02-30")).toBeNull();
    expect(parseDateString("2026-13-01")).toBeNull();
    expect(parseDateString("2026/02/01")).toBeNull();
    expect(parseDateString("")).toBeNull();
  });

  it("date arithmetic crosses months and years", () => {
    expect(addDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDateString("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateString("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("the default range is the last 7 calendar days (including today)", () => {
    const now = new Date("2026-10-30T04:00:00.000Z"); // GMT+8 12:00
    const result = resolveDateRange(null, null, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.to).toBe(todayGmt8(now));
    expect(result.range.from).toBe(addDaysToDateString(result.range.to, -6));
    expect(result.range.endUtc.getTime() - result.range.startUtc.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("invalid and inverted ranges return errors", () => {
    expect(resolveDateRange("2026-03-05", "2026-03-01").ok).toBe(false);
    expect(resolveDateRange("bad", "2026-03-01").ok).toBe(false);
  });

  it("zero-order days are still filled in", () => {
    expect(eachDateInRange("2026-03-01", "2026-03-03")).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("a range over 400 days includes both endpoints completely", () => {
    const dates = eachDateInRange("2025-01-01", "2026-10-30");
    expect(dates).toHaveLength(668);
    expect(dates[0]).toBe("2025-01-01");
    expect(dates.at(-1)).toBe("2026-10-30");
    expect(new Set(dates).size).toBe(dates.length);
  });
});
