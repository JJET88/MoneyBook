import { createHash, randomBytes } from "node:crypto";
import { query } from "../db.js";

export const SESSION_COOKIE = "moneybook_session";
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

/**
 * Sessions live in the database. The browser gets a random token in an
 * httpOnly cookie; we store only its hash, so a leaked database cannot be
 * used to impersonate anyone. Logging out deletes the row, which ends the
 * session for real (unlike a signed token that stays valid until it expires).
 */
export async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_MS;
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), userId, expiresAt]);
  return { token, expiresAt };
}

export async function findSessionUser(token) {
  if (!token) return null;
  const [user] = await query(
    `SELECT u.id, u.name, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), Date.now()],
  );
  return user ?? null;
}

export async function destroySession(token) {
  if (token) await query("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export async function deleteExpiredSessions() {
  await query("DELETE FROM sessions WHERE expires_at <= ?", [Date.now()]);
}
