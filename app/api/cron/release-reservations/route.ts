import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/inventory";

// Backstop for inventory holds whose checkout was abandoned without Stripe
// ever sending us a checkout.session.expired event (e.g. the customer just
// closed the tab before a session existed, or a webhook delivery was lost).
// Wired to run every 5 minutes via vercel.json `crons`. Protect with
// CRON_SECRET so this can't be hit by anyone else to churn the DB.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredReservations(prisma);
  return NextResponse.json({ released });
}
