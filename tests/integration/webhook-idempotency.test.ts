// CRITICAL COMMERCE-INTEGRITY TEST — mandatory per the production
// completion directive. Exercises the REAL webhook route handler
// (app/api/webhooks/stripe/route.ts) with a locally HMAC-signed test event
// — no network call to Stripe is made or needed; signature generation and
// verification are both pure local operations. Requires a real Postgres
// connection for the same reason as inventory-concurrency.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { getTestPrisma } from "./helpers";
import { reserveInventory } from "@/lib/inventory";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_local_only";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_never_calls_stripe";

const testStripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

let prisma: PrismaClient | null = null;
let productId: string;
let variantId: string;
let locationId: string;

beforeAll(async () => {
  prisma = await getTestPrisma();
  if (!prisma) return;

  const product = await prisma.product.create({
    data: {
      slug: `test-webhook-${Date.now()}`,
      name: "TEST Webhook Product",
      description: "test fixture — not real catalog data",
      category: "Sneaker",
      gender: "Unisex",
      status: "ACTIVE"
    }
  });
  productId = product.id;

  const location = await prisma.inventoryLocation.create({
    data: { code: `TEST-WH-${Date.now()}`, name: `Test Webhook Location ${Date.now()}` }
  });
  locationId = location.id;

  const variant = await prisma.productVariant.create({
    data: { productId, sku: `TEST-WEBHOOK-${Date.now()}`, priceCents: 35000 }
  });
  variantId = variant.id;

  await prisma.inventoryLevel.create({ data: { variantId, locationId, quantity: 5, reserved: 0 } });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.inventoryTransaction.deleteMany({ where: { variantId } }).catch(() => {});
  await prisma.orderItem.deleteMany({ where: { productVariantId: variantId } }).catch(() => {});
  await prisma.reservation.deleteMany({ where: { variantId } }).catch(() => {});
  await prisma.inventoryLevel.deleteMany({ where: { variantId } }).catch(() => {});
  await prisma.productVariant.deleteMany({ where: { id: variantId } }).catch(() => {});
  await prisma.product.deleteMany({ where: { id: productId } }).catch(() => {});
  await prisma.inventoryLocation.deleteMany({ where: { id: locationId } }).catch(() => {});
  await prisma.$disconnect();
});

function signedRequest(payload: string) {
  const sig = testStripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body: payload
  });
}

describe.skipIf(!process.env.DATABASE_URL)("Stripe webhook — idempotency and payment_status guard", () => {
  it("rejects an invalid signature", async () => {
    if (!prisma) return;
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const badReq = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=not_a_real_signature" },
      body: "{}"
    });
    const res = await POST(badReq as any);
    expect(res.status).toBe(400);
  });

  it("processing the same checkout.session.completed event twice creates exactly one order", async () => {
    if (!prisma) return;
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const checkoutAttemptId = `test-webhook-attempt-${Date.now()}`;
    const reserveResult = await prisma.$transaction((tx) =>
      reserveInventory(tx, { variantId, quantity: 1, checkoutAttemptId })
    );
    expect(reserveResult.ok).toBe(true);

    const sessionId = `cs_test_${Date.now()}`;
    const eventId = `evt_test_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          client_reference_id: checkoutAttemptId,
          payment_status: "paid",
          amount_total: 35000,
          payment_intent: `pi_test_${Date.now()}`,
          customer_details: { email: "webhook-test@example.com", name: "Test Buyer", phone: null, address: null },
          total_details: { amount_tax: 0, amount_shipping: 0 },
          shipping_details: null
        }
      }
    });

    const res1 = await POST(signedRequest(payload) as any);
    expect(res1.status).toBe(200);

    // Exact same event, replayed — simulates Stripe's at-least-once
    // webhook delivery redelivering the same event id.
    const res2 = await POST(signedRequest(payload) as any);
    expect(res2.status).toBe(200);

    const orders = await prisma.order.findMany({ where: { stripeSessionId: sessionId } });
    expect(orders.length).toBe(1); // +0 orders on replay, not +1

    const payments = await prisma.payment.findMany({ where: { orderId: orders[0].id } });
    expect(payments.length).toBe(1); // +0 payments on replay

    const saleTxns = await prisma.inventoryTransaction.findMany({ where: { variantId, type: "SALE" } });
    expect(saleTxns.length).toBe(1); // inventory decremented exactly once, not twice

    const level = await prisma.inventoryLevel.findUniqueOrThrow({
      where: { variantId_locationId: { variantId, locationId } }
    });
    expect(level.quantity).toBe(4); // started at 5, decremented by 1 — once, not twice

    const stripeEvents = await prisma.stripeEvent.findMany({ where: { stripeEventId: eventId } });
    expect(stripeEvents.length).toBe(1); // unique constraint — no duplicate event record

    await prisma.payment.deleteMany({ where: { orderId: orders[0].id } });
    await prisma.orderItem.deleteMany({ where: { orderId: orders[0].id } });
    await prisma.order.delete({ where: { id: orders[0].id } });
    await prisma.stripeEvent.deleteMany({ where: { stripeEventId: eventId } });
  });

  it("an unpaid checkout.session.completed (delayed payment method) does not create an order", async () => {
    if (!prisma) return;
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const checkoutAttemptId = `test-webhook-unpaid-${Date.now()}`;
    await prisma.$transaction((tx) => reserveInventory(tx, { variantId, quantity: 1, checkoutAttemptId }));

    const sessionId = `cs_test_unpaid_${Date.now()}`;
    const eventId = `evt_test_unpaid_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          client_reference_id: checkoutAttemptId,
          payment_status: "unpaid", // delayed payment method, not settled yet
          amount_total: 35000,
          customer_details: { email: "unpaid-test@example.com" },
          total_details: { amount_tax: 0, amount_shipping: 0 }
        }
      }
    });

    const res = await POST(signedRequest(payload) as any);
    expect(res.status).toBe(200);

    const orders = await prisma.order.findMany({ where: { stripeSessionId: sessionId } });
    expect(orders.length).toBe(0); // NO paid order from an unpaid session

    const saleTxns = await prisma.inventoryTransaction.findMany({
      where: { variantId, type: "SALE", referenceId: checkoutAttemptId }
    });
    expect(saleTxns.length).toBe(0); // NO inventory movement

    // Reservation should still be ACTIVE — untouched by the guard rejecting the order.
    const reservation = await prisma.reservation.findFirst({ where: { checkoutAttemptId } });
    expect(reservation?.status).toBe("ACTIVE");

    await prisma.stripeEvent.deleteMany({ where: { stripeEventId: eventId } });
    await prisma.$transaction(async (tx) => {
      const { releaseReservationsForAttempt } = await import("@/lib/inventory");
      await releaseReservationsForAttempt(tx, checkoutAttemptId);
    });
  });
});
