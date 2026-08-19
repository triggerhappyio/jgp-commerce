import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKeyFrom, assertRateLimiterConfigured } from "@/lib/rate-limit";

// Completes the guest-history claim started in app/api/auth/register —
// only after this link is clicked (proving control of the inbox) does the
// new User get linked to a pre-existing guest Customer record and its
// order/address/foot-profile history. Single-use: the token is deleted
// once consumed, whether or not the request format itself is well-formed.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  assertRateLimiterConfigured();
  const rateLimit = await checkRateLimit(clientKeyFrom(req, "verify-email"), 20, 60 * 60 * 1000, "verify-email");
  if (!rateLimit.allowed) {
    return NextResponse.redirect(`${appUrl}/account/login?verify=rate_limited`);
  }

  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase();

  if (!token || !email) {
    return NextResponse.redirect(`${appUrl}/account/login?verify=invalid`);
  }

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } }
  });

  if (!record || record.expires < new Date()) {
    return NextResponse.redirect(`${appUrl}/account/login?verify=expired`);
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    const customer = await tx.customer.findUnique({ where: { email } });
    if (user && customer && !customer.userId) {
      await tx.customer.update({ where: { id: customer.id }, data: { userId: user.id } });
    }
    await tx.verificationToken.delete({ where: { identifier_token: { identifier: email, token } } });
  });

  return NextResponse.redirect(`${appUrl}/account?verified=1`);
}
