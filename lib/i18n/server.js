import { cookies, headers } from "next/headers";
import { cache } from "react";
import { translator } from "./index.js";
import { isLang, LANG_COOKIE, pickLang, THEME_COOKIE, THEMES } from "./translate.js";

/** The language chosen in the header, or else the one the browser asks for. */
export const getLang = cache(async () => {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return pickLang((await headers()).get("accept-language"));
});

export const getT = async () => translator(await getLang());

/** "light", "dark", or "system" to follow the device. */
export async function getTheme() {
  const chosen = (await cookies()).get(THEME_COOKIE)?.value;
  return THEMES.includes(chosen) ? chosen : "system";
}
