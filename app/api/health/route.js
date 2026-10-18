import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/** For a host or load balancer to check the app is up: 200 when the database answers, 503 when it does not. */
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
