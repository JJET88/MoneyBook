import en from "./i18n/en.js";
import { makeT } from "./i18n/translate.js";

const english = makeT("en", en);

/**
 * An error whose message is safe to show to the person using the app.
 * `key` names the message in lib/i18n, so it can be shown in their language;
 * `message` holds the English, for logs and tests.
 */
export class AppError extends Error {
  constructor(status, key, vars = {}) {
    super(english(key, vars));
    this.status = status;
    this.key = key;
    this.vars = vars;
  }
}

export const notFound = () => new AppError(404, "err.noEntry");
