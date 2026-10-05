"use server";

// Server Actions: functions the browser can call that run on the server.
// Each one is a public endpoint, whatever the page that calls it looks like,
// so each one checks who is asking and validates everything it is given.
// (Next.js refuses Server Action calls that come from another site, which is
// the cross-site request forgery check.)
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser, setSessionCookie } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword, wasteTimeLikeAVerify } from "@/lib/auth/password";
import { createSession, deleteExpiredSessions, destroySession } from "@/lib/auth/sessions";
import { readBackup } from "@/lib/backup";
import { AppError } from "@/lib/errors";
import { getT } from "@/lib/i18n/server";
import { createLimiter } from "@/lib/limiter";
import * as book from "@/lib/repos/book";
import { createUser, findUserByEmail } from "@/lib/repos/users";
import { validateEntry, validateId, validateLogin, validateSettings, validateSignup } from "@/lib/validate";

// Ten log-in tries per email address, and ten new accounts per network
// address, every fifteen minutes.
const loginLimit = createLimiter(10, 15 * 60 * 1000);
const signupLimit = createLimiter(10, 15 * 60 * 1000);

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
    const address = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
    signupLimit(address);
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
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
    loginLimit(email);
    const user = await findUserByEmail(email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : (await wasteTimeLikeAVerify(password), false);
    // One message for both cases, so the form does not reveal which emails have accounts.
    if (!valid) throw new AppError(401, "err.badLogin");
    const session = await createSession(user.id);
    await setSessionCookie(session.token);
    deleteExpiredSessions().catch(() => {}); // housekeeping, not worth failing a log-in over
  } catch (error) {
    return failure(error);
  }
  redirect("/");
}

export async function logOut() {
  await destroySession(await clearSessionCookie());
  redirect("/login");
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
