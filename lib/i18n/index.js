// Every language's words, for the server. Each dictionary sits on top of the
// English one, so a message not yet translated shows in English.
import en from "./en.js";
import my from "./my.js";
import th from "./th.js";
import zh from "./zh.js";
import { DEFAULT_LANG, isLang, makeT } from "./translate.js";

const DICTIONARIES = { en, my, th, zh };
const translators = new Map();

export function messagesFor(lang) {
  return { ...en, ...DICTIONARIES[isLang(lang) ? lang : DEFAULT_LANG] };
}

export function translator(lang = DEFAULT_LANG) {
  if (!isLang(lang)) lang = DEFAULT_LANG;
  if (!translators.has(lang)) translators.set(lang, makeT(lang, messagesFor(lang)));
  return translators.get(lang);
}
