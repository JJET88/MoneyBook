// The history of each book: one line per thing that happened, newest last.
// Lines are written by the same transaction as the change they describe, so
// the history never claims a change that did not happen, or misses one that did.
import { query, withTransaction } from "../db.js";

/** `run` is `query`, or a transaction's own query function. */
export async function record(run, userId, action, { entryId = null, detail = null } = {}) {
  await run("INSERT INTO history (user_id, at, action, entry_id, detail) VALUES (?, ?, ?, ?, ?)", [
    userId, Date.now(), action, entryId, detail === null ? null : JSON.stringify(detail),
  ]);
}

/** A page of history, newest first. `before` is the id of the last line already shown. */
export async function listHistory(userId, { before = null, limit = 50 } = {}) {
  const rows = await query(
    `SELECT id, at, action, entry_id AS entryId, detail FROM history
      WHERE user_id = ? AND (? IS NULL OR id < ?)
      ORDER BY id DESC LIMIT ?`,
    [userId, before, before, limit + 1],
  );
  const items = rows.slice(0, limit).map((r) => ({
    id: Number(r.id),
    at: Number(r.at),
    action: r.action,
    entryId: r.entryId === null ? null : Number(r.entryId),
    detail: typeof r.detail === "string" ? JSON.parse(r.detail) : r.detail, // some servers send JSON as text
  }));
  return { items, more: rows.length > limit };
}

/** Empties one person's history, leaving a line that says so. */
export async function clearHistory(userId) {
  await withTransaction(async (run) => {
    await run("DELETE FROM history WHERE user_id = ?", [userId]);
    await record(run, userId, "history.clear");
  });
}
