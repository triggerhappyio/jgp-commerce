import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/inventory";

// Backstop for inventory holds whose checkout was abandoned without Stripe
// ever sending us a checkout.session.expired event (e.g. the customer just
// closed the tab before a session existed, or a webhook delivery was lost).
// Wired to run once daily via vercel.json `crons` (Vercel Hobby plan caps
// cron jobs at once/day — this is a backstop for reservations that
// somehow never got a checkout.session.expired webhook at all, not the
// primary release path, so a daily sweep is an acceptable trade-off; move
// to a tighter schedule if/when the account is on a Pro plan). Protect with
// CRON_SECRET so this can't be hit by anyone else to churn the DB.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredReservations(prisma);
  return NextResponse.json({ released });
}
