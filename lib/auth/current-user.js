import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cache } from "react";
import { findSessionUser, SESSION_COOKIE, SESSION_DAYS } from "./sessions.js";

/** The logged-in user, or null. Looked up once per request however many components ask. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  return findSessionUser(store.get(SESSION_COOKIE)?.value);
});

export async function setSessionCookie(token) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JavaScript, so a script injection cannot steal it
    sameSite: "lax", // not sent on cross-site POSTs
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}

/** For pages: the logged-in user, or off to the log-in page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
