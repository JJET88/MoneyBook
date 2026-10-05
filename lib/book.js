// The arithmetic of the book, kept free of the database and of React so it
// can be tested on its own.
import { monthName, shortDate, weekday } from "./dates.js";
import { translator } from "./i18n/index.js";

/**
 * Money left at the end of a month: the starting balance plus everything
 * received minus everything spent since.
 *
 * months: [{ ym, net }] where net already leaves out entries dated on or
 * before the starting date (they are inside the starting balance).
 * start: { date, amountMinor } or null.
 */
export function leftAfter(months, start, ym) {
  let left = start && start.date.slice(0, 7) <= ym ? start.amountMinor : 0;
  for (const month of months) if (month.ym <= ym) left += month.net;
  return left;
}

/** Without a starting balance or any money received, "left" would only be a negative total. */
export const canShowLeft = (months, start) => Boolean(start) || months.some((m) => m.in > 0);

/**
 * The figure to show as "left", or null when it is not known: either there
 * is nothing to count from yet, or the month is before the book started.
 */
export function leftAt(months, start, ym) {
  if (!canShowLeft(months, start)) return null;
  if (start && ym < start.date.slice(0, 7)) return null;
  return leftAfter(months, start, ym);
}

/**
 * Quick choices for the add form. Labels used in the two most recent months
 * come first, so the choices follow current habits; each remembers the last
 * amount written next to it.
 *
 * entries: [{ date, kind, label, amountMinor }] in any order.
 */
export function rankLabels(entries, kind) {
  const recentMonths = [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().slice(-2);
  const seen = new Map();
  for (const e of entries) {
    if (e.kind !== kind) continue;
    const key = e.label.toLowerCase();
    const item = seen.get(key) ?? { label: e.label, count: 0, recent: 0, lastMinor: e.amountMinor, when: "" };
    item.count += 1;
    if (recentMonths.includes(e.date.slice(0, 7))) item.recent += 1;
    if (e.date >= item.when) {
      item.when = e.date;
      item.lastMinor = e.amountMinor;
      item.label = e.label;
    }
    seen.set(key, item);
  }
  return [...seen.values()]
    .sort((a, b) => b.recent - a.recent || b.count - a.count || a.label.localeCompare(b.label))
    .map(({ label, lastMinor }) => ({ label, lastMinor }));
}

/** A month's entries as a page: newest day first, entries in the order they were written. */
export function groupByDay(entries, locale) {
  const days = new Map();
  for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return [...days.keys()].sort().reverse().map((date) => ({
    date,
    day: Number(date.slice(8, 10)),
    weekday: weekday(date, locale),
    items: days.get(date),
  }));
}

/** Spending by label, largest first; anything past `limit` is folded into one line. */
export function whereItWent(entries, limit = 8, t = translator()) {
  const sums = new Map();
  for (const e of entries) {
    if (e.kind !== "out") continue;
    const key = e.label.toLowerCase();
    sums.set(key, { name: sums.get(key)?.name ?? e.label, total: (sums.get(key)?.total ?? 0) + e.amountMinor });
  }
  const sorted = [...sums.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const shown = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((sum, x) => sum + x.total, 0);
  if (rest > 0) shown.push({ name: t("book.everythingElse"), total: rest });
  return shown;
}

/**
 * Everything the Year page shows, worked out in one place.
 * months: [{ ym, in, out, net, count }] for every month that has entries.
 * t: the reader's translator from lib/i18n (English when left out).
 */
export function yearTable(months, start, year, todayYm, t = translator()) {
  const byMonth = new Map(months.map((m) => [m.ym, m]));
  const thisYear = Number(todayYm.slice(0, 4));
  const rows = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    const month = byMonth.get(ym) ?? { in: 0, out: 0, count: 0 };
    totalIn += month.in;
    totalOut += month.out;
    if (start && start.date.slice(0, 7) === ym) {
      rows.push({ type: "start", label: t("year.start", { date: shortDate(start.date, t.locale) }), left: start.amountMinor });
    }
    const future = ym > todayYm && month.count === 0;
    rows.push({
      type: "month",
      ym,
      name: monthName(ym, { month: "long" }, t.locale),
      in: month.in,
      out: month.out,
      count: month.count,
      left: future ? null : leftAt(months, start, ym),
    });
  }

  const largest = Math.max(...rows.map((r) => r.out ?? 0), 1);
  for (const row of rows) if (row.type === "month") row.share = row.out / largest;

  // "Left" for the year: now, if it is this year; otherwise at the end of that year.
  return {
    rows,
    in: totalIn,
    out: totalOut,
    left: leftAt(months, start, year === thisYear ? todayYm : `${year}-12`),
    canShowLeft: canShowLeft(months, start),
    leftLabel: t(year === thisYear ? "year.leftNow" : "year.leftYearEnd"),
  };
}
