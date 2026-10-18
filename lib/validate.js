import { isDate } from "./dates.js";
import { AppError } from "./errors.js";
import { parseAmountMinor } from "./money.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value) => (typeof value === "string" ? value : "");

export function validateSignup(body) {
  const name = text(body?.name).trim();
  const email = text(body?.email).trim().toLowerCase();
  const password = text(body?.password);
  if (!name) throw new AppError(400, "err.nameMissing");
  if (name.length > 40) throw new AppError(400, "err.nameLong");
  if (!EMAIL.test(email) || email.length > 190) throw new AppError(400, "err.emailInvalid");
  if (password.length < 8) throw new AppError(400, "err.passwordShort");
  if (password.length > 200) throw new AppError(400, "err.passwordLong");
  return { name, email, password };
}

export function validateLogin(body) {
  const email = text(body?.email).trim().toLowerCase();
  const password = text(body?.password);
  if (!email || !password) throw new AppError(400, "err.loginMissing");
  return { email, password };
}

export function validateId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) throw new AppError(400, "err.noEntry");
  return id;
}

export function validatePasswordChange(body) {
  const current = text(body?.current);
  const password = text(body?.password);
  if (!current) throw new AppError(400, "err.currentMissing");
  if (password.length < 8) throw new AppError(400, "err.passwordShort");
  if (password.length > 200) throw new AppError(400, "err.passwordLong");
  return { current, password };
}

/** One line of the book, as typed into a form. */
export function validateEntry(body) {
  const label = text(body?.label).replace(/\s+/g, " ").trim();
  const amountMinor = parseAmountMinor(body?.amount);
  if (!label) throw new AppError(400, "err.labelMissing");
  if (label.length > 40) throw new AppError(400, "err.labelLong");
  if (amountMinor === null) throw new AppError(400, "err.amount");
  if (!isDate(body?.date)) throw new AppError(400, "err.date");
  if (body?.kind !== "in" && body?.kind !== "out") throw new AppError(400, "err.kind");
  return { date: body.date, kind: body.kind, label, amountMinor };
}

/** The starting balance needs both its amount and its date, or neither. */
export function validateSettings(body) {
  const currency = text(body?.currency).trim();
  const amountText = text(body?.amount).trim();
  const date = text(body?.date);
  if ([...currency].length > 4) throw new AppError(400, "err.currencyLong");
  if (!amountText && !date) return { currency, start: null };
  const amountMinor = parseAmountMinor(amountText, { allowZero: true });
  if (amountMinor === null) throw new AppError(400, "err.startAmount");
  if (!isDate(date)) throw new AppError(400, "err.startDate");
  return { currency, start: { date, amountMinor } };
}
