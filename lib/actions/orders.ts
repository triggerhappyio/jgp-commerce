"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { FulfillmentStatus, OrderStatus } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });

// Every action in this module re-checks role server-side, on top of the
// admin layout + middleware checks — sensitive writes should never rely
// solely on the caller having reached a page through the "right" UI.
async function requireStaff() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

const VALID_FULFILLMENT: string[] = Object.values(FulfillmentStatus);

export async function updateFulfillment(orderId: string, formData: FormData) {
  await requireStaff();

  const fulfillmentStatus = formData.get("fulfillmentStatus") as string;
  const trackingNumber = (formData.get("trackingNumber") as string) || null;
  const carrier = (formData.get("carrier") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!VALID_FULFILLMENT.includes(fulfillmentStatus)) {
    throw new Error("Invalid fulfillment status");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: fulfillmentStatus as FulfillmentStatus,
      trackingNumber,
      carrier,
      notes
    }
  });

  if (fulfillmentStatus === "SHIPPED" && trackingNumber) {
    await prisma.shipment.create({
      data: { orderId, carrier: carrier ?? undefined, trackingNumber, status: "shipped", shippedAt: new Date() }
    });
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function cancelOrder(orderId: string) {
  await requireStaff();
  await prisma.order.update({
    where: { id: orderId },
    data: { fulfillmentStatus: FulfillmentStatus.CANCELLED, status: OrderStatus.CANCELLED }
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function refundOrder(orderId: string, formData: FormData) {
  const session = await requireStaff();

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured — cannot issue a refund.");
  }

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.stripePaymentIntentId) {
    throw new Error("This order has no Stripe payment to refund.");
  }

  const totals = await prisma.refund.aggregate({ where: { orderId }, _sum: { amountCents: true } });
  const alreadyRefunded = totals._sum.amountCents ?? 0;
  const remaining = order.totalCents - alreadyRefunded;

  const amountStr = formData.get("amountCents") as string;
  const reason = (formData.get("reason") as string) || undefined;
  const amountCents = amountStr ? Math.round(Number(amountStr)) : remaining;

  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > remaining) {
    throw new Error("Invalid refund amount — must be between 1 and the remaining unrefunded balance.");
  }

  const stripeRefund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
    reason: "requested_by_customer"
  });

  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId,
        stripeRefundId: stripeRefund.id,
        amountCents,
        reason,
        createdByUserId: (session.user as any).id
      }
    });

    const totals = await tx.refund.aggregate({ where: { orderId }, _sum: { amountCents: true } });
    const totalRefunded = totals._sum.amountCents ?? 0;

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: totalRefunded >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED"
      }
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}
