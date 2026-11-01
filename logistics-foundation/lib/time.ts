// 全项目统一时区口径：数据库保存 UTC；界面与报表按 GMT+8 展示和分日。
export const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;
export const TIMEZONE_LABEL = "GMT+8";

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** UTC 时间 → GMT+8 的 “YYYY-MM-DD HH:mm:ss”。 */
export function formatGmt8(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() + GMT8_OFFSET_MS);
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
  );
}

/** UTC 时间 → GMT+8 的 “YYYY-MM-DD”。 */
export function gmt8DateString(value: Date | string): string {
  return formatGmt8(value).slice(0, 10);
}

/** GMT+8 的今天（自然日字符串）。 */
export function todayGmt8(now: Date = new Date()): string {
  return gmt8DateString(now);
}

/** 严格解析 “YYYY-MM-DD”，非法日期返回 null。 */
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

/** GMT+8 某自然日 00:00 对应的 UTC 瞬间。 */
export function gmt8DayStartUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - GMT8_OFFSET_MS);
}

/** GMT+8 自然日字符串加 n 天，返回新的字符串。 */
export function addDaysToDateString(value: string, days: number): string {
  const parsed = parseDateString(value);
  if (!parsed) return value;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export interface DateRange {
  from: string;
  to: string;
  /** 含起始日 00:00:00 (GMT+8)，以 UTC 表示。 */
  startUtc: Date;
  /** 不含结束日次日 00:00:00 (GMT+8)，以 UTC 表示。 */
  endUtc: Date;
}

/**
 * 解析查询里的 from/to（GMT+8 自然日，起始含、结束含整天）。
 * 缺省为最近 7 个自然日（含今天）。非法输入返回错误信息。
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
  if (!fromParts) return { ok: false, message: "起始日期须为 YYYY-MM-DD" };
  if (!toParts) return { ok: false, message: "结束日期须为 YYYY-MM-DD" };
  if (from > to) return { ok: false, message: "起始日期不能晚于结束日期" };
  const endExclusive = addDaysToDateString(to, 1);
  const endParts = parseDateString(endExclusive);
  if (!endParts) return { ok: false, message: "日期范围超出可处理范围" };
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

/** 生成范围内每个 GMT+8 自然日：用于趋势图的零值补齐。 */
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
