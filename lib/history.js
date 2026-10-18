// The history in words. Pure functions: the History page passes in the rows
// from lib/repos/history.js and a t() for the reader's language.
import { fullDate, momentIn } from "./dates.js";
import { formatMoney } from "./money.js";

// Lines that are worth a second look: someone else may have been at the book.
const WARNINGS = new Set(["login.failed", "book.erase", "history.clear"]);

/** One line of history as { title, lines, warn }. */
export function describeHistory(item, t, currency = "") {
  const money = (minor) => formatMoney(minor, currency);
  const entry = (e) => t(e.kind === "in" ? "history.entryIn" : "history.entryOut", { label: e.label, amount: money(e.amountMinor), date: fullDate(e.date, t.locale) });
  const settings = (s) => [
    s.start ? t("history.start", { amount: formatMoney(s.start.amountMinor, s.currency), date: fullDate(s.start.date, t.locale) }) : t("history.noStart"),
    s.currency ? t("history.currency", { currency: s.currency }) : t("history.noCurrency"),
  ].join(" · ");
  const d = item.detail ?? {};
  const key = `action.${item.action}`;
  const title = t(key) === key ? item.action : t(key); // an action this version does not know: show its name
  let lines = [];
  if (item.action === "entry.add" && d.after) lines = [entry(d.after)];
  if (item.action === "entry.delete" && d.before) lines = [entry(d.before)];
  if (item.action === "entry.change" && d.before && d.after) lines = [t("history.was", { what: entry(d.before) }), t("history.now", { what: entry(d.after) })];
  if (item.action === "settings.save" && d.before && d.after) lines = [t("history.was", { what: settings(d.before) }), t("history.now", { what: settings(d.after) })];
  if (item.action === "book.restore") lines = [t("history.restoredText", { entries: t("count.entries", { n: d.entries ?? 0 }), replaced: t("count.entries", { n: d.replaced ?? 0 }) })];
  if (item.action === "book.erase") lines = [t("history.erasedText", { entries: t("count.entries", { n: d.entries ?? 0 }) })];
  return { title, lines, warn: WARNINGS.has(item.action) };
}

/** History lines grouped by the day they happened, newest first, as the page shows them. */
export function groupHistory(items, t, currency = "", timeZone = process.env.APP_TIME_ZONE) {
  const days = [];
  for (const item of items) {
    const { date, time } = momentIn(item.at, timeZone, t.locale);
    if (days.at(-1)?.date !== date) days.push({ date, items: [] });
    days.at(-1).items.push({ id: item.id, time, ...describeHistory(item, t, currency) });
  }
  return days;
}
