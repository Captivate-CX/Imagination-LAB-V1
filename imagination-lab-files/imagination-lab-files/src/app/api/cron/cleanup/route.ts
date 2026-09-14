import { NextResponse } from "next/server";
import { cleanupExpired } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Runs daily (see vercel.json) and deletes projects older than the retention period. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const removed = await cleanupExpired();
  return NextResponse.json({ removed });
}
