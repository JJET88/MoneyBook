import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toBackup } from "@/lib/backup";
import { serverToday } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { allEntries, getSettings } from "@/lib/repos/book";

/** The whole book as a file to keep. Reading it changes nothing, so a plain link can fetch it. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: (await getT())("err.loginForBackup") }, { status: 401 });
  const [settings, entries] = await Promise.all([getSettings(user.id), allEntries(user.id)]);
  const today = serverToday();
  return new NextResponse(JSON.stringify(toBackup(settings, entries, today), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-book-${today}.json"`,
      "Cache-Control": "no-store", // personal data: never keep a copy in a shared cache
    },
  });
}
