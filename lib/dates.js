// Dates are handled as plain text ("2026-09-30") and months as "2026-09".
// Text of this shape sorts in date order and never shifts with a time zone.

const pad = (n) => String(n).padStart(2, "0");
const utc = (date) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10) || 1)));

/** A real calendar date between 2000 and 2100 (so no 31 February). */
export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const d = utc(value);
  return d.getUTCMonth() + 1 === Number(value.slice(5, 7)) && d.getUTCDate() === Number(value.slice(8, 10));
}

export const isMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && isDate(value + "-01");

export function shiftMonth(ym, by) {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// Month and day names are written in the reader's language: `locale` is a
// language's locale from lib/i18n (for example "th-TH-u-ca-gregory").

/** "2026-09" -> "September 2026" (or just "September" with { month: "long" }). */
export const monthName = (ym, options = { month: "long", year: "numeric" }, locale = "en-GB") =>
  utc(ym + "-01").toLocaleDateString(locale, { ...options, timeZone: "UTC" });

/** "2026-09-30" -> "Wed" */
export const weekday = (date, locale = "en-GB") => utc(date).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });

/** "2026-03-31" -> "31 Mar" */
export const shortDate = (date, locale = "en-GB") => utc(date).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Today's date on the server. Servers usually run on UTC, which is the wrong
 * day for part of every day in most of the world, so APP_TIME_ZONE (for
 * example Asia/Bangkok) says where the people using the app are.
 */
export function serverToday(timeZone = process.env.APP_TIME_ZONE) {
  const format = (zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  try {
    return format(timeZone || undefined);
  } catch {
    return format(undefined); // an unknown zone name: fall back to the server's own
  }
}

/** Today's date where the browser is. */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-03-31" -> "31 Mar 2026" */
export const fullDate = (date, locale = "en-GB") =>
  utc(date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A moment (milliseconds since 1970) as the day it fell on in `timeZone`,
 * and the time of day: { date: "2026-10-18", time: "14:05" }.
 */
export function momentIn(ms, timeZone = process.env.APP_TIME_ZONE, locale = "en-GB") {
  const at = new Date(ms);
  const parts = (zone) => ({
    date: new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at),
    time: new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at),
  });
  try {
    return parts(timeZone || undefined);
  } catch {
    return parts(undefined); // an unknown zone name: fall back to the server's own
  }
}
