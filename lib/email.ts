// Transactional email — service interface only. No provider is wired in
// (see .env.example "Not wired in yet"). This does NOT pretend an email
// was delivered: `sendEmail()` logs the would-be send in development and
// logs a loud, explicit "not configured" error in production, but never
// reports success for a send that didn't happen.
//
// When a provider is picked (Resend is the natural fit — same team as
// Vercel, generous free tier, good deliverability), only this file
// changes: swap the body of `sendEmail()` for a real API call. No call
// site (order confirmation, refund confirmation, etc.) needs to change.
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  const provider = process.env.RESEND_API_KEY;

  if (!provider) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email] (dev, no provider configured) would send to ${message.to}: "${message.subject}"`);
    } else {
      console.error(
        `[email] No email provider configured — "${message.subject}" to ${message.to} was NOT sent. Set RESEND_API_KEY (or wire a different provider into lib/email.ts).`
      );
    }
    return { sent: false };
  }

  // TODO: real provider call goes here once RESEND_API_KEY (or equivalent)
  // is set. Intentionally not stubbed further — a fake "success" path here
  // would be exactly the kind of pretend-it-was-delivered behavior this
  // file exists to avoid.
  console.error(`[email] RESEND_API_KEY is set but no provider integration is implemented yet.`);
  return { sent: false };
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
