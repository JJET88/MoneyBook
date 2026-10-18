"use server";

// Server Actions: functions the browser can call that run on the server.
// Each one is a public endpoint, whatever the page that calls it looks like,
// so each one checks who is asking and validates everything it is given.
// (Next.js refuses Server Action calls that come from another site, which is
// the cross-site request forgery check.)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { clearSessionCookie, clientAddress, currentSessionToken, getCurrentUser, setSessionCookie } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword, wasteTimeLikeAVerify } from "@/lib/auth/password";
import { createSession, deleteExpiredSessions, destroySession } from "@/lib/auth/sessions";
import { readBackup } from "@/lib/backup";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getT } from "@/lib/i18n/server";
import { createLimiter } from "@/lib/limiter";
import { attemptStore, deleteOldAttempts } from "@/lib/repos/attempts";
import * as book from "@/lib/repos/book";
import { clearHistory, record } from "@/lib/repos/history";
import { createUser, findPasswordHash, findUserByEmail, setPassword } from "@/lib/repos/users";
import { validateEntry, validateId, validateLogin, validatePasswordChange, validateSettings, validateSignup } from "@/lib/validate";

// Every fifteen minutes: ten log-in tries per email address, thirty per
// network address (one address trying many emails), ten new accounts per
// network address, and ten tries at the current password per account.
// Counted in the database, so they hold across restarts and server processes.
const WINDOW = 15 * 60 * 1000;
const limit = (name, max) => createLimiter(max, WINDOW, { name, store: attemptStore });
const loginLimit = limit("login", 10);
const addressLimit = limit("address", 30);
const signupLimit = limit("signup", 10);
const passwordLimit = limit("password", 10);

/** Errors we raised on purpose carry a message for the person, in their language; anything else is logged, not shown. */
async function failure(error) {
  const t = await getT();
  if (error instanceof AppError) return { error: t(error.key, error.vars) };
  console.error(error);
  return { error: t("err.server") };
}

async function signedIn() {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "err.loggedOut");
  return user;
}

const bookChanged = () => revalidatePath("/", "layout");

// ---------- accounts ----------

export async function signUp(_previous, formData) {
  try {
    const { name, email, password } = validateSignup(Object.fromEntries(formData));
    await signupLimit(await clientAddress());
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    await record(query, user.id, "signup");
    const session = await createSession(user.id);
    await setSessionCookie(session.token);
  } catch (error) {
    return failure(error);
  }
  redirect("/"); // outside the try: redirect works by throwing
}

export async function logIn(_previous, formData) {
  try {
    const { email, password } = validateLogin(Object.fromEntries(formData));
    await Promise.all([loginLimit(email), addressLimit(await clientAddress())]);
    const user = await findUserByEmail(email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : (await wasteTimeLikeAVerify(password), false);
    // One message for both cases, so the form does not reveal which emails have accounts.
    if (!valid) {
      // The owner sees it in their history. Written after the answer is sent,
      // so a known email does not take longer to refuse than an unknown one.
      if (user) after(() => record(query, user.id, "login.failed"));
      throw new AppError(401, "err.badLogin");
    }
    const session = await createSession(user.id);
    await setSessionCookie(session.token);
    await record(query, user.id, "login");
    // Housekeeping, not worth failing a log-in over.
    deleteExpiredSessions().catch(() => {});
    deleteOldAttempts().catch(() => {});
  } catch (error) {
    return failure(error);
  }
  redirect("/");
}

export async function logOut() {
  await destroySession(await clearSessionCookie());
  redirect("/login");
}

export async function changePassword(input) {
  try {
    const user = await signedIn();
    const { current, password } = validatePasswordChange(input);
    await passwordLimit(String(user.id));
    if (!(await verifyPassword(current, await findPasswordHash(user.id)))) throw new AppError(400, "err.currentWrong");
    await setPassword(user.id, await hashPassword(password), await currentSessionToken());
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------- the book ----------

export async function addEntry(input) {
  try {
    const user = await signedIn();
    const entry = validateEntry(input);
    await book.addEntry(user.id, entry);
    bookChanged();
    return { ok: true, ...entry };
  } catch (error) {
    return failure(error);
  }
}

export async function changeEntry(id, input) {
  try {
    const user = await signedIn();
    const entry = validateEntry(input);
    await book.updateEntry(user.id, validateId(id), entry);
    bookChanged();
    return { ok: true, ...entry };
  } catch (error) {
    return failure(error);
  }
}

export async function removeEntry(id) {
  try {
    const user = await signedIn();
    await book.deleteEntry(user.id, validateId(id));
    bookChanged();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSettings(input) {
  try {
    const user = await signedIn();
    await book.saveSettings(user.id, validateSettings(input));
    bookChanged();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreBackup(fileText) {
  try {
    const user = await signedIn();
    const backup = readBackup(fileText);
    await book.replaceBook(user.id, backup);
    bookChanged();
    return { ok: true, months: backup.months, entries: backup.entries.length };
  } catch (error) {
    return failure(error);
  }
}

export async function eraseEverything() {
  try {
    const user = await signedIn();
    await book.eraseBook(user.id);
    bookChanged();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function clearMyHistory() {
  try {
    const user = await signedIn();
    await clearHistory(user.id);
    bookChanged();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
