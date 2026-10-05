import "./globals.css";
import { logOut } from "./actions";
import I18nProvider from "@/components/I18n";
import Preferences from "@/components/Preferences";
import Tabs from "@/components/Tabs";
import ToastProvider from "@/components/Toast";
import { getCurrentUser } from "@/lib/auth/current-user";
import { messagesFor } from "@/lib/i18n";
import { getLang, getT, getTheme } from "@/lib/i18n/server";
import { languageOf } from "@/lib/i18n/translate";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("app.name"), description: t("app.description") };
}

export const viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }) {
  const [user, lang, theme] = await Promise.all([getCurrentUser(), getLang(), getTheme()]);
  const t = await getT();
  return (
    // data-theme is set only when the person chose light or dark; without it the device decides.
    <html lang={languageOf(lang).htmlLang} data-theme={theme === "system" ? undefined : theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Atkinson Hyperlegible is drawn to be easy to read; the Noto fonts cover Burmese and Thai. Chinese uses the device's own font. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Noto+Sans+Myanmar:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" />
      </head>
      <body>
        <I18nProvider lang={lang} messages={messagesFor(lang)}>
          <ToastProvider>
            <div className="app">
              <header className="top">
                <h1>{t("app.name")}</h1>
                <div className="top-end">
                  <Preferences theme={theme} />
                  {user && (
                    <form action={logOut} className="who">
                      <span>{user.name}</span>
                      <button type="submit" className="quiet">{t("header.logOut")}</button>
                    </form>
                  )}
                </div>
              </header>
              {user && <Tabs />}
              <main className="stack">{children}</main>
            </div>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
