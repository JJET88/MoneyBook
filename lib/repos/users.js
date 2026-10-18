import { AppError } from "../errors.js";
import { query, withTransaction } from "../db.js";
import { hashToken } from "../auth/sessions.js";
import { record } from "./history.js";

export async function createUser({ name, email, passwordHash }) {
  try {
    const result = await query("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [name, email, passwordHash]);
    return { id: result.insertId, name, email };
  } catch (error) {
    // Let the unique index decide, instead of checking first: two sign-ups
    // with the same email at the same moment cannot both get through.
    if (error.code === "ER_DUP_ENTRY") throw new AppError(409, "err.emailTaken");
    throw error;
  }
}

export async function findUserByEmail(email) {
  const [user] = await query("SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?", [email]);
  return user ?? null;
}

export async function findPasswordHash(userId) {
  const [row] = await query("SELECT password_hash AS passwordHash FROM users WHERE id = ?", [userId]);
  return row?.passwordHash ?? null;
}

/**
 * A new password, and every session but the one in use is ended: whoever
 * may have known the old password is logged out everywhere.
 */
export async function setPassword(userId, passwordHash, keepToken) {
  await withTransaction(async (run) => {
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
    await run("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?", [userId, hashToken(keepToken ?? "")]);
    await record(run, userId, "password.change");
  });
}
