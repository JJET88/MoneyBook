import { AppError } from "../errors.js";
import { query } from "../db.js";

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
