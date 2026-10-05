// Every read and write of a person's book. Each function takes the user's id
// and puts it in the WHERE clause, so one person can never reach another's
// entries however the request is put together.
import { query, withTransaction } from "../db.js";
import { notFound } from "../errors.js";

const ENTRY_COLUMNS = "id, entry_date AS date, kind, label, amount_minor AS amountMinor";

// ---------- settings ----------

export async function getSettings(userId) {
  const [row] = await query("SELECT currency, start_date AS date, start_amount_minor AS amountMinor FROM settings WHERE user_id = ?", [userId]);
  if (!row) return { currency: "", start: null };
  return { currency: row.currency, start: row.date ? { date: row.date, amountMinor: Number(row.amountMinor) } : null };
}

const SAVE_SETTINGS = `
  INSERT INTO settings (user_id, currency, start_date, start_amount_minor) VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE currency = VALUES(currency), start_date = VALUES(start_date), start_amount_minor = VALUES(start_amount_minor)`;
const settingsParams = (userId, { currency, start }) => [userId, currency, start?.date ?? null, start?.amountMinor ?? null];

export async function saveSettings(userId, settings) {
  await query(SAVE_SETTINGS, settingsParams(userId, settings));
}

// ---------- entries ----------

/** One month's entries, in the order they were written. */
export async function listMonth(userId, ym) {
  return query(
    `SELECT ${ENTRY_COLUMNS} FROM entries
      WHERE user_id = ? AND entry_date >= ? AND entry_date < ? + INTERVAL 1 MONTH
      ORDER BY entry_date, id`,
    [userId, `${ym}-01`, `${ym}-01`],
  );
}

export async function addEntry(userId, { date, kind, label, amountMinor }) {
  const result = await query("INSERT INTO entries (user_id, entry_date, kind, label, amount_minor) VALUES (?, ?, ?, ?, ?)", [userId, date, kind, label, amountMinor]);
  return result.insertId;
}

export async function updateEntry(userId, id, { date, kind, label, amountMinor }) {
  const result = await query(
    "UPDATE entries SET entry_date = ?, kind = ?, label = ?, amount_minor = ? WHERE id = ? AND user_id = ?",
    [date, kind, label, amountMinor, id, userId],
  );
  if (result.affectedRows === 0) throw notFound();
}

export async function deleteEntry(userId, id) {
  const result = await query("DELETE FROM entries WHERE id = ? AND user_id = ?", [id, userId]);
  if (result.affectedRows === 0) throw notFound();
}

/**
 * Totals for every month that has entries, oldest first. The database adds
 * them up, so the Year page costs one query however long the book gets.
 * `net` leaves out entries dated on or before the starting date: those are
 * already inside the starting balance.
 */
export async function monthTotals(userId, startDate = null) {
  const rows = await query(
    `SELECT DATE_FORMAT(entry_date, '%Y-%m') AS ym,
            SUM(IF(kind = 'in', amount_minor, 0)) AS received,
            SUM(IF(kind = 'out', amount_minor, 0)) AS spent,
            SUM(IF(? IS NULL OR entry_date > ?, IF(kind = 'in', amount_minor, -amount_minor), 0)) AS net,
            COUNT(*) AS count
       FROM entries
      WHERE user_id = ?
      GROUP BY ym
      ORDER BY ym`,
    [startDate, startDate, userId],
  );
  // SUM comes back as text (it can be larger than a JavaScript integer in general).
  return rows.map((r) => ({ ym: r.ym, in: Number(r.received), out: Number(r.spent), net: Number(r.net), count: Number(r.count) }));
}

/** The latest entries, for working out the quick choices. */
export async function recentEntries(userId, limit = 500) {
  return query(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE user_id = ? ORDER BY entry_date DESC, id DESC LIMIT ?`, [userId, limit]);
}

/** The whole book, oldest first: for the backup file and the spreadsheet. */
export async function allEntries(userId) {
  return query(`SELECT ${ENTRY_COLUMNS} FROM entries WHERE user_id = ? ORDER BY entry_date, id`, [userId]);
}

/**
 * Replace the whole book with a backup. In a transaction: if anything fails
 * part-way, the old book is still there, untouched.
 */
export async function replaceBook(userId, { settings, entries }) {
  await withTransaction(async (run) => {
    await run("DELETE FROM entries WHERE user_id = ?", [userId]);
    for (let i = 0; i < entries.length; i += 500) {
      const rows = entries.slice(i, i + 500).map((e) => [userId, e.date, e.kind, e.label, e.amountMinor]);
      await run("INSERT INTO entries (user_id, entry_date, kind, label, amount_minor) VALUES ?", [rows]);
    }
    await run(SAVE_SETTINGS, settingsParams(userId, settings));
  });
}

export async function eraseBook(userId) {
  await withTransaction(async (run) => {
    await run("DELETE FROM entries WHERE user_id = ?", [userId]);
    await run("DELETE FROM settings WHERE user_id = ?", [userId]);
  });
}
