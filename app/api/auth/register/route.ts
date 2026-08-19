import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(clientKeyFrom(req, "register"), 5, 60 * 60 * 1000); // 5/hour/IP
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

    // No email provider is wired in yet (see lib/email.ts / README) — this
    // does NOT pretend to have sent anything. In development the link is
    // logged so the flow is actually testable; in production this needs a
    // real transactional-email send wired in before guest-order claiming
    // can work end-to-end. Until then, existing guest history simply stays
    // unclaimed rather than being handed out on an unverified email.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] verification link for ${email}: ${verifyUrl}`);
    } else {
      console.error(
        `[auth] verification link generated for ${email} but no email provider is configured — link was not delivered: ${verifyUrl}`
      );
    }
  }

  return NextResponse.json({ ok: true, verificationRequired, userId: user.id });
}
