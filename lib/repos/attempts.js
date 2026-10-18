// The limiter's store in the database (see lib/limiter.js).
import { createHash } from "node:crypto";
import { query } from "../db.js";

const hashKey = (key) => createHash("sha256").update(key).digest("hex");

export const attemptStore = {
  async add(key, at) {
    await query("INSERT INTO attempts (key_hash, at) VALUES (?, ?)", [hashKey(key), at]);
  },
  async count(key, since) {
    const [row] = await query("SELECT COUNT(*) AS n FROM attempts WHERE key_hash = ? AND at > ?", [hashKey(key), since]);
    return Number(row.n);
  },
};

export async function deleteOldAttempts(before = Date.now() - 24 * 60 * 60 * 1000) {
  await query("DELETE FROM attempts WHERE at <= ?", [before]);
}
