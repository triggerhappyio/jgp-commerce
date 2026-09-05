// Transactional email — Resend in production, a safe console adapter in
// development. This does NOT pretend an email was delivered: `sendEmail()`
// only ever reports `sent: true` after Resend actually accepts the
// message; every other path (no provider configured, Resend API error)
// reports `sent: false` and logs why, loudly.
//
// Email failure must never roll back or block an already-legitimate
// commerce action (a payment, a refund) — see every call site in
// app/api/webhooks/stripe and lib/actions/*.ts: sendEmail() is called
// after the transaction commits, its result is logged, and it is never
// awaited inside the same transaction as the financial write.
import { Resend } from "resend";
import { appEnv } from "@/lib/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Production fails closed for the same reason as
 * lib/rate-limit.ts's assertRateLimiterConfigured(): a production
 * deployment silently not sending order confirmations is a worse failure
 * mode than refusing to start handling the request that would have
 * triggered one. Call sites that consider email non-optional (none do
 * today — see the comment above) would call this; the current call sites
 * treat email as best-effort and don't.
 */
export function assertEmailProviderConfigured(): void {
  if (appEnv() === "production" && (!getResend() || !process.env.EMAIL_FROM)) {
    throw new Error("Email is not configured for production: set RESEND_API_KEY and EMAIL_FROM.");
  }
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;

  if (!resend || !from) {
    if (appEnv() !== "production") {
      console.log(`[email] (dev, no provider configured) would send to ${message.to}: "${message.subject}"`);
      return { sent: false };
    }
    const reason = "No email provider configured (RESEND_API_KEY / EMAIL_FROM missing)";
    console.error(`[email] ${reason} — "${message.subject}" to ${message.to} was NOT sent.`);
    return { sent: false, error: reason };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    if (result.error) {
      console.error(`[email] Resend rejected "${message.subject}" to ${message.to}:`, result.error);
      return { sent: false, error: result.error.message };
    }
    return { sent: true };
  } catch (err: any) {
    console.error(`[email] Failed to send "${message.subject}" to ${message.to}:`, err);
    return { sent: false, error: String(err?.message ?? err) };
  }
}

// ── Templates ────────────────────────────────────────────────────────────
// Plain-text bodies for now (correct content matters more than HTML polish
// for a not-yet-wired-up provider) — swap in real HTML templates alongside
// the real provider integration above.

export function orderConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  totalCents: number;
  items: { productName: string; quantity: number }[];
}): EmailMessage {
  const lines = params.items.map((i) => `  ${i.quantity}x ${i.productName}`).join("\n");
  return {
    to: params.to,
    subject: `Your JGP order ${params.orderNumber} is confirmed`,
    text: `Thanks for your order!\n\nOrder ${params.orderNumber}\n${lines}\n\nTotal: $${(params.totalCents / 100).toFixed(2)}`
  };
}

export function shippingConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}): EmailMessage {
  return {
    to: params.to,
    subject: `Your JGP order ${params.orderNumber} has shipped`,
    text: `Your order is on its way.${
      params.trackingNumber ? `\n\nTracking (${params.carrier ?? "carrier"}): ${params.trackingNumber}` : ""
    }`
  };
}

export function refundConfirmationEmail(params: { to: string; orderNumber: string; amountCents: number }): EmailMessage {
  return {
    to: params.to,
    subject: `Refund issued for order ${params.orderNumber}`,
    text: `A refund of $${(params.amountCents / 100).toFixed(2)} has been issued for order ${params.orderNumber}. It may take 5–10 business days to appear on your statement.`
  };
}

export function accountVerificationEmail(params: { to: string; verifyUrl: string }): EmailMessage {
  return {
    to: params.to,
    subject: "Confirm your email — JGP USA",
    text: `Confirm your email to link your order history to your new account:\n\n${params.verifyUrl}\n\nThis link expires in 24 hours.`
  };
}

export function passwordResetEmail(params: { to: string; resetUrl: string }): EmailMessage {
  return {
    to: params.to,
    subject: "Reset your password — JGP USA",
    text: `Reset your password:\n\n${params.resetUrl}\n\nIf you didn't request this, you can ignore this email — password reset is not implemented yet (see README), this template exists for when it is.`
  };
}
