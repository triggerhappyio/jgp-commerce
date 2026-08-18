import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Idempotency: if we've already recorded this session, don't double-write.
    const existing = await prisma.order.findUnique({
      where: { stripeSessionId: session.id }
    });
    if (existing) {
      return NextResponse.json({ received: true, note: "already processed" });
    }

    const items: { slug: string; qty: number }[] = session.metadata?.items
      ? JSON.parse(session.metadata.items)
      : [];

    let customer = null;
    if (session.customer_details?.email) {
      customer = await prisma.customer.upsert({
        where: { email: session.customer_details.email },
        update: {},
        create: {
          email: session.customer_details.email,
          name: session.customer_details.name || undefined
        }
      });
    }

    // The order, its line items, and the inventory decrement all happen in
    // one transaction — either the whole paid order lands consistently, or
    // none of it does.
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: customer?.id,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          status: "paid",
          totalCents: session.amount_total ?? 0,
          shippingAddress: (session.shipping_details as any) ?? undefined
        }
      });

      for (const item of items) {
        // Cart items are keyed by product slug, which doubles as sku until
        // the real Shopify SKUs are migrated in (see prisma/seed.ts).
        const variant = await tx.productVariant.findUnique({ where: { sku: item.slug } });
        if (!variant) {
          // Payment already succeeded — never drop the order over a missing
          // catalog row. Log it so the mismatch gets caught and fixed.
          console.error(`No ProductVariant for sku "${item.slug}" (order ${order.id})`);
          continue;
        }
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productVariantId: variant.id,
            quantity: item.qty,
            unitPriceCents: variant.priceCents
          }
        });
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { inventoryQty: { decrement: item.qty } }
        });
      }
    });
  }

  return NextResponse.json({ received: true });
}
