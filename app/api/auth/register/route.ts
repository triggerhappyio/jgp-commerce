import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKeyFrom, assertRateLimiterConfigured } from "@/lib/rate-limit";
import { sendEmail, accountVerificationEmail } from "@/lib/email";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  assertRateLimiterConfigured();
  const rateLimit = await checkRateLimit(clientKeyFrom(req, "register"), 5, 60 * 60 * 1000, "register"); // 5/hour/IP
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : undefined;

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Deliberately generic — do not reveal via a different message whether
    // an account exists so registration can't be used to enumerate emails.
    return NextResponse.json({ error: "Could not create account with these details." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Does a guest Customer (from a past unauthenticated checkout) already
  // exist for this email? If so, there's order/address/foot-profile
  // history behind it — do NOT attach it to this new account yet. Anyone
  // can type in anyone else's email address at registration; only linking
  // it after they've proven they control that inbox (verification token
  // below) is what makes the claim safe. The account itself still works
  // immediately either way — this only gates the *history claim*, not
  // registration or login.
  const existingCustomer = await prisma.customer.findUnique({ where: { email } });

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, passwordHash, name: name || undefined }
    });
    if (!existingCustomer) {
      await tx.customer.create({ data: { email, name: name || undefined, userId: created.id } });
    }
    return created;
  });

  let verificationRequired = false;
  if (existingCustomer) {
    verificationRequired = true;
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires: new Date(Date.now() + VERIFICATION_TTL_MS) }
    });

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    // Always logged in development regardless of email outcome, so the
    // claim flow stays testable without a real provider configured.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] verification link for ${email}: ${verifyUrl}`);
    }

    // lib/email.ts's sendEmail() never pretends to have delivered
    // something it didn't — if no provider is configured, this logs and
    // returns sent:false rather than silently no-oping. Until a provider
    // is wired in, existing guest history simply stays unclaimed rather
    // than being handed out on an unverified email (the whole point of
    // requiring this step at all).
    const result = await sendEmail(accountVerificationEmail({ to: email, verifyUrl }));
    if (!result.sent && process.env.NODE_ENV === "production") {
      console.error(`[auth] verification email not sent for ${email}: ${result.error ?? "no provider configured"}`);
    }
  }

  return NextResponse.json({ ok: true, verificationRequired, userId: user.id });
}
