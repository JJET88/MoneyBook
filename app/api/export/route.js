import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toCsv } from "@/lib/backup";
import { serverToday } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { allEntries } from "@/lib/repos/book";

/** Every entry as a .csv file that Excel, Google Sheets and Numbers can open. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: (await getT())("err.loginForCsv") }, { status: 401 });
  // The first three bytes tell Excel the file is UTF-8, so ฿ and Burmese text survive.
  return new NextResponse("﻿" + toCsv(await allEntries(user.id)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-book-${serverToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
