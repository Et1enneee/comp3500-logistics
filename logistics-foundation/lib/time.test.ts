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

describe("GMT+8 时间口径", () => {
  it("UTC 16:00 是 GMT+8 次日 00:00", () => {
    expect(formatGmt8("2026-03-01T16:00:00.000Z")).toBe("2026-03-02 00:00:00");
    expect(gmt8DateString("2026-03-01T15:59:59.999Z")).toBe("2026-03-01");
    expect(gmt8DateString("2026-03-01T16:00:00.000Z")).toBe("2026-03-02");
  });

  it("自然日起点换算成 UTC 边界", () => {
    expect(gmt8DayStartUtc(2026, 3, 1).toISOString()).toBe("2026-02-28T16:00:00.000Z");
  });

  it("严格解析日期，拒绝越界值", () => {
    expect(parseDateString("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseDateString("2026-02-30")).toBeNull();
    expect(parseDateString("2026-13-01")).toBeNull();
    expect(parseDateString("2026/02/01")).toBeNull();
    expect(parseDateString("")).toBeNull();
  });

  it("日期加减跨月跨年", () => {
    expect(addDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDateString("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateString("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("默认区间为最近 7 个自然日（含今天）", () => {
    const now = new Date("2026-10-30T04:00:00.000Z"); // GMT+8 12:00
    const result = resolveDateRange(null, null, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.range.to).toBe(todayGmt8(now));
    expect(result.range.from).toBe(addDaysToDateString(result.range.to, -6));
    expect(result.range.endUtc.getTime() - result.range.startUtc.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("非法区间与倒置区间报错", () => {
    expect(resolveDateRange("2026-03-05", "2026-03-01").ok).toBe(false);
    expect(resolveDateRange("bad", "2026-03-01").ok).toBe(false);
  });

  it("零订单日也补齐日期", () => {
    expect(eachDateInRange("2026-03-01", "2026-03-03")).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("超过 400 天的区间完整包含首尾日期", () => {
    const dates = eachDateInRange("2025-01-01", "2026-10-30");
    expect(dates).toHaveLength(668);
    expect(dates[0]).toBe("2025-01-01");
    expect(dates.at(-1)).toBe("2026-10-30");
    expect(new Set(dates).size).toBe(dates.length);
  });
});
