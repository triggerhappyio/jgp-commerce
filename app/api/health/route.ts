import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appEnv } from "@/lib/env";

// Public shallow check — deliberately minimal. Never runs a DB query, a
// Stripe call, or an email send: this endpoint may be hit frequently by
// uptime monitors, and none of those side effects belong on every poll.
//
// Deeper diagnostics (DB reachability, which providers are configured)
// are gated behind CRON_SECRET — the same bearer-secret pattern already
// used for /api/cron/release-reservations — because "which internal
// services are/aren't configured" is exactly the kind of system detail
// that shouldn't be handed to an anonymous caller.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const deep = auth === `Bearer ${process.env.CRON_SECRET}` && !!process.env.CRON_SECRET;

  if (!deep) {
    return NextResponse.json({ status: "ok" });
  }

  const checks: Record<string, boolean | string> = {
    app: true,
    environment: appEnv()
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err: any) {
    checks.database = false;
    checks.databaseError = String(err?.message ?? err).slice(0, 200);
  }

  checks.redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  checks.emailConfigured = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  checks.storageConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  checks.stripeConfigured = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  checks.stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    ? "live"
    : process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
      ? "test"
      : "unconfigured";

  const healthy = checks.database === true;
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503 });
}
