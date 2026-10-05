// The parts of translation that both the server and the browser need. The
// dictionaries themselves are not imported here, so a page only ever sends
// the browser the one language it is shown in.

export const LANGUAGES = [
  { code: "en", name: "English", locale: "en-GB", htmlLang: "en" },
  // Latin digits, so dates match the amounts beside them.
  { code: "my", name: "မြန်မာ", locale: "my-u-nu-latn", htmlLang: "my" },
  // Gregorian years, so "2026" in the page and in the address agree (not 2569).
  { code: "th", name: "ไทย", locale: "th-TH-u-ca-gregory", htmlLang: "th" },
  { code: "zh", name: "中文", locale: "zh-CN", htmlLang: "zh-CN" },
];

export const DEFAULT_LANG = "en";
export const LANG_COOKIE = "lang";
export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));
export const isLang = (value) => byCode.has(value);
export const languageOf = (code) => byCode.get(code) ?? byCode.get(DEFAULT_LANG);

/** "th-TH,th;q=0.9,en;q=0.8" -> "th". The first language we have, in the order the browser prefers. */
export function pickLang(acceptLanguage) {
  const wanted = String(acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { code: tag.toLowerCase().split("-")[0], q: q === undefined ? 1 : Number(q) || 0 };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.find((w) => isLang(w.code))?.code ?? DEFAULT_LANG;
}

/**
 * t("toast.added", { label: "food", amount: "65" }) -> "Added food 65".
 * A message may be { one, other } to follow the count in vars.n. A missing
 * message shows its key, which is easy to spot and never breaks the page.
 */
export function makeT(lang, messages) {
  const { locale } = languageOf(lang);
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const t = (key, vars = {}) => {
    let text = messages[key] ?? key;
    if (typeof text === "object") text = text[plural.select(vars.n ?? 0)] ?? text.other;
    return text.replace(/\{(\w+)\}/g, (whole, name) => {
      const value = vars[name];
      if (value === undefined) return whole; // left for <Rich> to fill with a link
      return typeof value === "number" ? number.format(value) : String(value);
    });
  };
  t.lang = lang;
  t.locale = locale;
  return t;
}
