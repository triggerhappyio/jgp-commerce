import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { commitReservationsForAttempt, releaseReservationsForAttempt } from "@/lib/inventory";
import { formatOrderNumber } from "@/lib/orders";
import { sendEmail, orderConfirmationEmail } from "@/lib/email";
import { ReservationStatus } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20"
});

// Never trust a client-reported "payment succeeded" — this webhook, verified
// against Stripe's signature, is the only place an Order is written.
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return NextResponse.json({ error: `Signature verification failed: ${err.message}` }, { status: 400 });
  }

  // Idempotency, layer 1: every event id is logged before it's acted on.
  // If we've already fully processed this exact event, this is a no-op —
  // Stripe retries the same event id on redelivery, so this alone would be
  // enough even without layer 2 below.
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, note: "already processed" });
  }
  if (!existing) {
    await prisma.stripeEvent.create({
      data: { stripeEventId: event.id, type: event.type, payload: event as any }
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.client_reference_id) {
        await prisma.$transaction((tx) => releaseReservationsForAttempt(tx, session.client_reference_id!), { timeout: 15000 });
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      // checkout.ts pins payment_method_types to ["card"], which never goes
      // through the delayed-payment path, so this shouldn't fire in
      // practice. Handled anyway rather than left silently unhandled: if
      // Stripe ever sends it, finalize the order the same way as a normal
      // completion instead of losing the sale.
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.error(`[webhook] async payment failed for session ${session.id} — releasing hold`);
      if (session.client_reference_id) {
        await prisma.$transaction((tx) => releaseReservationsForAttempt(tx, session.client_reference_id!), { timeout: 15000 });
      }
    }

    await prisma.stripeEvent.update({ where: { stripeEventId: event.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`[webhook] failed to process ${event.type} (${event.id}):`, err);
    await prisma.stripeEvent.update({ where: { stripeEventId: event.id }, data: { error: err.message } });
    // 500 so Stripe retries — the event row's processedAt is still null, so
    // the retry will actually re-run the handler rather than short-circuit.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Idempotency, layer 2 (belt and suspenders): even if the same session
  // somehow reached here twice, the order itself can only ever be created once.
  const existingOrder = await prisma.order.findUnique({ where: { stripeSessionId: session.id } });
  if (existingOrder) return;

  const checkoutAttemptId = session.client_reference_id;
  if (!checkoutAttemptId) {
    console.error(`[webhook] checkout.session.completed with no client_reference_id (session ${session.id})`);
    return;
  }

  // checkout.session.completed fires even for delayed payment methods
  // before they've actually settled (payment_status stays "unpaid" until a
  // later async_payment_succeeded/failed event). checkout.ts pins card-only
  // so this should always already be "paid" here — this guard is what makes
  // that an enforced invariant rather than an assumption. If it's ever not
  // paid yet, wait for the async event instead of recording a sale that
  // hasn't happened.
  if (session.payment_status !== "paid") {
    console.error(
      `[webhook] checkout.session.completed with payment_status "${session.payment_status}" (session ${session.id}) — waiting for async payment resolution`
    );
    return;
  }

  const confirmationEmail = await prisma.$transaction(async (tx) => {
    // Prisma's default interactive-transaction timeout is 5000ms — too
    // tight for this transaction's real shape (find reservations, upsert
    // customer, create + update order, commit N reservations, create N
    // order items, create payment — several sequential round trips).
    // Discovered via a real timeout against live Neon Postgres
    // (tests/integration/webhook-idempotency.test.ts), not a hypothetical
    // — see the `{ timeout: 15000 }` below.
    const reservations = await tx.reservation.findMany({
      where: { checkoutAttemptId, status: ReservationStatus.ACTIVE },
      include: { variant: { include: { product: true } } }
    });

    if (reservations.length === 0) {
      console.error(`[webhook] no active reservations for checkout attempt ${checkoutAttemptId} — cannot build order`);
      return null;
    }

    let customer = null;
    if (session.customer_details?.email) {
      customer = await tx.customer.upsert({
        where: { email: session.customer_details.email },
        update: {},
        create: {
          email: session.customer_details.email,
          name: session.customer_details.name || undefined,
          phone: session.customer_details.phone || undefined
        }
      });
    }

    const subtotalCents = reservations.reduce((sum, r) => sum + r.variant.priceCents * r.quantity, 0);
    const totalCents = session.amount_total ?? subtotalCents;
    const taxCents = session.total_details?.amount_tax ?? 0;
    const shippingCents = session.total_details?.amount_shipping ?? 0;

    // orderNumber depends on orderSeq, which Postgres only assigns once the
    // row exists — create with a unique placeholder, then fix it up in the
    // same transaction once we know the real sequence value.
    const order = await tx.order.create({
      data: {
        orderNumber: `PENDING-${checkoutAttemptId}`,
        customerId: customer?.id,
        email: session.customer_details?.email ?? "unknown@jgpusa.com",
        phone: session.customer_details?.phone || undefined,
        shippingAddress: (session.shipping_details as any) ?? undefined,
        billingAddress: (session.customer_details?.address as any) ?? undefined,
        subtotalCents,
        taxCents,
        shippingCents,
        totalCents,
        paymentStatus: "PAID",
        source: "JGP_WEB",
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined
      }
    });
    await tx.order.update({
      where: { id: order.id },
      data: { orderNumber: formatOrderNumber(order.orderSeq) }
    });

    await commitReservationsForAttempt(tx, { checkoutAttemptId, orderId: order.id });

    for (const r of reservations) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productVariantId: r.variantId,
          productName: r.variant.product.name,
          sku: r.variant.sku,
          color: r.variant.color,
          size: r.variant.size,
          unitPriceCents: r.variant.priceCents,
          quantity: r.quantity,
          totalCents: r.variant.priceCents * r.quantity
        }
      });
    }

    await tx.payment.create({
      data: {
        orderId: order.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        amountCents: totalCents,
        status: "succeeded"
      }
    });

    return {
      to: order.email,
      orderNumber: formatOrderNumber(order.orderSeq),
      totalCents,
      items: reservations.map((r) => ({ productName: r.variant.product.name, quantity: r.quantity }))
    };
  }, { timeout: 15000 });

  // Sent after the transaction commits, deliberately — a slow/unavailable
  // email provider must never block or roll back an already-successful
  // payment/order write. sendEmail() never throws (see lib/email.ts); its
  // result is only logged.
  if (confirmationEmail) {
    const result = await sendEmail(orderConfirmationEmail(confirmationEmail));
    if (!result.sent) {
      console.error(`[webhook] order confirmation email not sent for ${confirmationEmail.orderNumber}: ${result.error ?? "no provider configured"}`);
    }
  }
}
