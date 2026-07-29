import { cleanupExpired } from "@/lib/server/polls";
import { runJson } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// Hard-deletes Polls (and, by cascade, participants + free_slots) 7 days past
// their last date. Wired to a Vercel Cron (see vercel.json), which invokes via
// GET and sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runJson(cleanupExpired());
}
