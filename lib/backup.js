// The backup file. It is the same file the single-page Money Book writes, so
// a book can move between the two:
//
//   { app: "money-book", version: 1, savedOn: "2026-10-04",
//     docs: { settings: { currency, start: { date, amount } },
//             "m-2026-09": { entries: [{ id, d, k, w, a }] } } }
//
// d = day of the month, k = "out" | "in", w = what for, a = amount.
import { isDate } from "./dates.js";
import { AppError } from "./errors.js";
import { parseAmountMinor } from "./money.js";

export const MAX_BACKUP_CHARS = 1_500_000;
export const MAX_BACKUP_ENTRIES = 20_000;
const NOT_A_BACKUP = "err.notBackup";

/** Build the file from what the database holds. */
export function toBackup(settings, entries, savedOn) {
  const docs = {};
  if (settings.currency || settings.start) {
    docs.settings = { currency: settings.currency };
    if (settings.start) docs.settings.start = { date: settings.start.date, amount: settings.start.amountMinor / 100 };
  }
  for (const e of entries) {
    const doc = (docs[`m-${e.date.slice(0, 7)}`] ??= { entries: [] });
    doc.entries.push({ id: String(e.id), d: Number(e.date.slice(8, 10)), k: e.kind, w: e.label, a: e.amountMinor / 100 });
  }
  return { app: "money-book", version: 1, savedOn, docs };
}

/**
 * Read a backup file's text. A file is something a stranger could have
 * written, so only the shapes above are accepted and everything else in it
 * is ignored; nothing from the file reaches the database unchecked.
 */
export function readBackup(fileText) {
  if (typeof fileText !== "string" || fileText.length > MAX_BACKUP_CHARS) throw new AppError(400, "err.backupTooLarge");
  let parsed;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new AppError(400, NOT_A_BACKUP);
  }
  const docs = parsed?.docs;
  if (parsed?.app !== "money-book" || !docs || typeof docs !== "object" || Array.isArray(docs)) throw new AppError(400, NOT_A_BACKUP);

  const settings = { currency: "", start: null };
  const entries = [];
  let hasSettings = false;

  for (const [id, body] of Object.entries(docs)) {
    if (id === "settings" && body && typeof body === "object") {
      hasSettings = true;
      if (typeof body.currency === "string") settings.currency = [...body.currency.trim()].slice(0, 4).join("");
      const amountMinor = parseAmountMinor(body.start?.amount, { allowZero: true });
      if (isDate(body.start?.date) && amountMinor !== null) settings.start = { date: body.start.date, amountMinor };
    } else if (/^m-\d{4}-\d{2}$/.test(id) && Array.isArray(body?.entries)) {
      for (const e of body.entries) {
        const date = `${id.slice(2)}-${String(e?.d).padStart(2, "0")}`;
        const amountMinor = parseAmountMinor(e?.a);
        const label = typeof e?.w === "string" ? e.w.replace(/\s+/g, " ").trim().slice(0, 40) : "";
        if (!isDate(date) || amountMinor === null || !label) continue; // skip a damaged line, keep the rest
        entries.push({ date, kind: e.k === "in" ? "in" : "out", label, amountMinor });
        if (entries.length > MAX_BACKUP_ENTRIES) throw new AppError(400, "err.backupTooMany", { max: MAX_BACKUP_ENTRIES });
      }
    }
  }

  if (!entries.length && !hasSettings) throw new AppError(400, NOT_A_BACKUP);
  const months = new Set(entries.map((e) => e.date.slice(0, 7))).size;
  return { settings, entries, months };
}

/**
 * The whole book as a spreadsheet file. A cell that starts with = + - or @
 * is run as a formula by spreadsheet programs, so such labels get a leading
 * apostrophe: opening the file must never run something a label says.
 */
export function toCsv(entries) {
  const cell = (value) => {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["date", "kind", "what for", "amount"].join(",")];
  for (const e of entries) {
    lines.push([e.date, e.kind === "in" ? "received" : "spent", cell(e.label), (e.amountMinor / 100).toFixed(2)].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
