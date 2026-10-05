"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT } from "@/lib/i18n/translate";

const I18nContext = createContext(null);

/** t() for client components. The layout passes in only the words of the language being shown. */
export const useT = () => useContext(I18nContext);

export default function I18nProvider({ lang, messages, children }) {
  const t = useMemo(() => makeT(lang, messages), [lang, messages]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}
