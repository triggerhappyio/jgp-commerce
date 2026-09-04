"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { adjustInventory } from "@/lib/inventory";
import { InventoryTransactionType, ReturnStatus } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

// V1 exchange is deliberately constrained to same-price variant swaps only
// (see docs/RETURNS_EXCHANGES.md). A price-difference exchange is not a
// safe generalized settlement to fake — staff should process those as
// return + refund + a new separate order instead.
const RESTOCKABLE_CONDITIONS = ["Sellable — restock"];

// ─────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────

export async function createReturn(orderId: string, formData: FormData) {
  const session = await requireStaff();

  const reason = (formData.get("reason") as string) || undefined;
  const orderItemIds = formData.getAll("orderItemId") as string[];
  if (orderItemIds.length === 0) {
    throw new Error("Select at least one item to return.");
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

    const ret = await tx.return.create({
      data: { orderId, customerId: order.customerId, reason, status: ReturnStatus.REQUESTED }
    });

    for (const orderItemId of orderItemIds) {
      const orderItem = order.items.find((i) => i.id === orderItemId);
      if (!orderItem) throw new Error(`Order item ${orderItemId} does not belong to this order.`);

      const requestedQty = Number(formData.get(`quantity_${orderItemId}`) ?? 1);
      if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
        throw new Error(`Invalid return quantity for ${orderItem.productName}.`);
      }
      if (requestedQty > orderItem.quantity) {
        throw new Error(`Cannot return more than the ${orderItem.quantity} purchased for ${orderItem.productName}.`);
      }

      // Remaining returnable = purchased - already requested/in-flight on
      // any non-rejected return for this same OrderItem. Prevents
      // returning the same unit twice across separate Return records.
      const priorReturned = await tx.returnItem.aggregate({
        where: { orderItemId, return: { status: { not: ReturnStatus.REJECTED } } },
        _sum: { quantity: true }
      });
      const alreadyReturned = priorReturned._sum.quantity ?? 0;
      const remaining = orderItem.quantity - alreadyReturned;
      if (requestedQty > remaining) {
        throw new Error(
          `Only ${remaining} unit(s) of ${orderItem.productName} remain eligible for return (already returned/pending: ${alreadyReturned}).`
        );
      }

      const exchangeForVariantId = (formData.get(`exchangeFor_${orderItemId}`) as string) || null;
      if (exchangeForVariantId) {
        if (!orderItem.productVariantId) {
          throw new Error(`${orderItem.productName} has no linked variant — cannot process as an exchange.`);
        }
        const [original, replacement] = await Promise.all([
          tx.productVariant.findUniqueOrThrow({ where: { id: orderItem.productVariantId } }),
          tx.productVariant.findUnique({ where: { id: exchangeForVariantId } })
        ]);
        if (!replacement || !replacement.active) {
          throw new Error("Selected exchange replacement is not available.");
        }
        // V1 constraint, enforced here, not just documented: unequal-price
        // exchanges are refused outright rather than silently mis-settled.
        if (replacement.priceCents !== original.priceCents) {
          throw new Error(
            `Exchange replacement must be the same price ($${(original.priceCents / 100).toFixed(2)}). ` +
              `For a price difference, process this as a return + refund, and a separate new order.`
          );
        }
      }

      await tx.returnItem.create({
        data: {
          returnId: ret.id,
          orderItemId,
          productVariantId: orderItem.productVariantId!,
          quantity: requestedQty,
          exchangeForVariantId: exchangeForVariantId || undefined
        }
      });
    }

    return ret;
  }, { timeout: 15000 }); // loops per selected order item — see the same fix in checkout.ts/webhook.ts for why

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/returns");
}

// ─────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────

export async function markReceived(returnId: string) {
  await requireStaff();
  const ret = await prisma.return.findUniqueOrThrow({ where: { id: returnId } });
  if (ret.status !== ReturnStatus.REQUESTED) {
    throw new Error(`Cannot mark received from status ${ret.status}.`);
  }
  await prisma.return.update({ where: { id: returnId }, data: { status: ReturnStatus.RECEIVED } });
  revalidatePath(`/admin/returns/${returnId}`);
}

export async function inspectItem(returnId: string, returnItemId: string, formData: FormData) {
  await requireStaff();
  const condition = formData.get("condition") as string;
  if (!condition) throw new Error("Select a condition.");

  await prisma.$transaction(async (tx) => {
    const ret = await tx.return.findUniqueOrThrow({ where: { id: returnId }, include: { items: true } });
    if (ret.status !== ReturnStatus.RECEIVED && ret.status !== ReturnStatus.INSPECTED) {
      throw new Error(`Cannot inspect items from status ${ret.status}.`);
    }

    await tx.returnItem.update({ where: { id: returnItemId }, data: { condition } });

    const items = await tx.returnItem.findMany({ where: { returnId } });
    const allInspected = items.every((i) => i.id === returnItemId || i.condition);
    if (allInspected && ret.status === ReturnStatus.RECEIVED) {
      await tx.return.update({ where: { id: returnId }, data: { status: ReturnStatus.INSPECTED } });
    }
  });

  revalidatePath(`/admin/returns/${returnId}`);
}

export async function rejectReturn(returnId: string, formData: FormData) {
  await requireStaff();
  const reason = (formData.get("reason") as string) || "Rejected by staff";
  const ret = await prisma.return.findUniqueOrThrow({ where: { id: returnId } });
  if (ret.status === ReturnStatus.RESTOCKED || ret.status === ReturnStatus.REFUNDED || ret.status === ReturnStatus.EXCHANGED) {
    throw new Error(`Cannot reject a return that has already completed (${ret.status}).`);
  }
  await prisma.return.update({ where: { id: returnId }, data: { status: ReturnStatus.REJECTED, reason } });
  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath("/admin/returns");
}

// ─────────────────────────────────────────────────────────────────────────
// Completion — the only place inventory is restored / a replacement is
// committed / a refund is issued for a return. Idempotent: only runs from
// INSPECTED, and moves the status to a terminal state, so a second call
// (double-click, retry) fails the status guard rather than double-acting.
// ─────────────────────────────────────────────────────────────────────────

export async function completeReturn(returnId: string) {
  const session = await requireStaff();

  await prisma.$transaction(
    async (tx) => {
      const ret = await tx.return.findUniqueOrThrow({
        where: { id: returnId },
        include: { items: { include: { orderItem: true } }, order: true }
      });
      if (ret.status !== ReturnStatus.INSPECTED) {
        throw new Error(`Cannot complete a return from status ${ret.status} — every item must be inspected first.`);
      }

      const exchangeItems = ret.items.filter((i) => i.exchangeForVariantId);
      const refundOnlyItems = ret.items.filter((i) => !i.exchangeForVariantId);

      for (const item of ret.items) {
        const restockable = item.condition ? RESTOCKABLE_CONDITIONS.includes(item.condition) : false;
        if (!restockable) continue;

        // Restock to the default location — OrderItem doesn't carry a
        // sale location (see docs/RETURNS_EXCHANGES.md), so returns land
        // in one known place staff can redistribute manually if needed.
        const defaultLocation = await tx.inventoryLocation.findFirst({ where: { isDefault: true } });
        const location = defaultLocation ?? (await tx.inventoryLocation.findFirstOrThrow());

        await adjustInventory(tx, {
          variantId: item.productVariantId,
          locationId: location.id,
          quantityChange: item.quantity,
          type: InventoryTransactionType.RETURN,
          reason: `Return ${returnId} — condition: ${item.condition}`,
          createdByUserId: (session.user as any).id,
          referenceType: "Return",
          referenceId: returnId
        });
        await tx.returnItem.update({ where: { id: item.id }, data: { restocked: true } });

        if (item.exchangeForVariantId) {
          // Commit the replacement: decrement it now (not reserved ahead of
          // time — the customer already has the original in hand, being
          // exchanged in person/by mail, not competing with other online
          // shoppers the way a fresh checkout would).
          const replacementLevel = await tx.inventoryLevel.findFirst({
            where: { variantId: item.exchangeForVariantId },
            orderBy: { quantity: "desc" }
          });
          if (!replacementLevel || replacementLevel.quantity - replacementLevel.reserved < item.quantity) {
            throw new Error(
              `Replacement variant is out of stock — cannot complete this exchange. Reject or hold this return instead.`
            );
          }
          await adjustInventory(tx, {
            variantId: item.exchangeForVariantId,
            locationId: replacementLevel.locationId,
            quantityChange: -item.quantity,
            type: InventoryTransactionType.EXCHANGE,
            reason: `Exchange fulfillment for return ${returnId}`,
            createdByUserId: (session.user as any).id,
            referenceType: "Return",
            referenceId: returnId
          });
        }
      }

      // Refund path — only for lines that aren't part of an exchange.
      // Reuses the same row-locked "remaining balance" pattern as
      // lib/actions/orders.ts refundOrder for the same reason: two
      // completions of returns against the same order must never be able
      // to jointly over-refund it.
      if (refundOnlyItems.length > 0) {
        const refundAmountCents = refundOnlyItems.reduce((sum, i) => sum + i.orderItem.unitPriceCents * i.quantity, 0);

        const [order] = await tx.$queryRaw<{ id: string; stripePaymentIntentId: string | null; totalCents: number }[]>`
          SELECT id, "stripePaymentIntentId", "totalCents" FROM "Order" WHERE id = ${ret.orderId} FOR UPDATE
        `;
        if (!order.stripePaymentIntentId) {
          throw new Error("This order has no Stripe payment to refund.");
        }
        const totals = await tx.refund.aggregate({ where: { orderId: order.id }, _sum: { amountCents: true } });
        const alreadyRefunded = totals._sum.amountCents ?? 0;
        const remaining = order.totalCents - alreadyRefunded;
        if (refundAmountCents > remaining) {
          throw new Error(
            `Refund amount ($${(refundAmountCents / 100).toFixed(2)}) exceeds the order's remaining refundable balance ($${(remaining / 100).toFixed(2)}).`
          );
        }

        if (!process.env.STRIPE_SECRET_KEY) {
          throw new Error("Stripe is not configured — cannot issue the refund for this return.");
        }
        const stripeRefund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: refundAmountCents,
          reason: "requested_by_customer"
        });

        await tx.refund.create({
          data: {
            orderId: order.id,
            stripeRefundId: stripeRefund.id,
            amountCents: refundAmountCents,
            reason: `Return ${returnId}`,
            createdByUserId: (session.user as any).id
          }
        });

        const newTotals = await tx.refund.aggregate({ where: { orderId: order.id }, _sum: { amountCents: true } });
        const totalRefunded = newTotals._sum.amountCents ?? 0;
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: totalRefunded >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED" }
        });
      }

      const finalStatus =
        exchangeItems.length > 0 && refundOnlyItems.length === 0
          ? ReturnStatus.EXCHANGED
          : refundOnlyItems.length > 0
            ? ReturnStatus.REFUNDED
            : ReturnStatus.RESTOCKED;

      await tx.return.update({ where: { id: returnId }, data: { status: finalStatus } });
    },
    { timeout: 15000 }
  );

  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath("/admin/returns");
  revalidatePath("/admin/orders");
}
