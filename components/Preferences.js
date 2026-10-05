"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LANG_COOKIE, LANGUAGES, THEME_COOKIE } from "@/lib/i18n/translate";
import { useT } from "./I18n";

const YEAR = 365 * 24 * 60 * 60;
const ICONS = { system: "◐", light: "☀", dark: "☾" };

// Kept in cookies, not the account, so they also work on the log-in page.
const remember = (name, value) => { document.cookie = `${name}=${value}; path=/; max-age=${value ? YEAR : 0}; samesite=lax`; };

/** Language and colours, at the top of every page. */
export default function Preferences({ theme: initialTheme }) {
  const t = useT();
  const router = useRouter();
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();

  function chooseTheme(event) {
    const value = event.target.value;
    setTheme(value);
    remember(THEME_COOKIE, value === "system" ? "" : value);
    // Colours change at once; the cookie makes the server draw the next page the same way.
    if (value === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  }

  function chooseLanguage(event) {
    remember(LANG_COOKIE, event.target.value);
    startTransition(() => router.refresh()); // the server writes the page again in the new language
  }

  return (
    <div className="prefs">
      <select className="pref" aria-label={t("prefs.language")} value={t.lang} disabled={pending} onChange={chooseLanguage}>
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.htmlLang}>{l.name}</option>)}
      </select>
      <select className="pref" aria-label={t("prefs.theme")} value={theme} onChange={chooseTheme}>
        {Object.entries(ICONS).map(([value, icon]) => <option key={value} value={value}>{icon} {t(`theme.${value}`)}</option>)}
      </select>
    </div>
  );
}
