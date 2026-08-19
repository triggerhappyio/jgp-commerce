import { Prisma, PrismaClient, InventoryTransactionType, ReservationStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// INVENTORY RESERVATION STRATEGY
//
// Stock is held the moment a customer commits to checkout, not just at
// final payment. Flow:
//
//   1. checkout route: for every cart line, reserveInventory() tries to
//      atomically grab enough stock at one location. Each success creates
//      a Reservation (status ACTIVE, quantity, expiresAt ~30 min out) and
//      bumps InventoryLevel.reserved — never InventoryLevel.quantity.
//      If ANY line can't be reserved, the whole attempt is rolled back and
//      checkout is refused with a clear "out of stock" error before Stripe
//      is ever involved.
//   2. Available-to-sell is always `quantity - reserved`, computed on read
//      — never a stored/denormalized number, so it can't drift.
//   3. webhook (checkout.session.completed): commitReservations() converts
//      each ACTIVE reservation into a real sale — decrements on-hand
//      quantity, decrements reserved by the same amount, marks the
//      reservation COMMITTED, and writes an audit InventoryTransaction.
//   4. webhook (checkout.session.expired) or the release-reservations cron
//      (backstop for sessions abandoned without Stripe ever telling us):
//      releaseExpiredReservations() gives the held stock back by
//      decrementing reserved, marks the reservation RELEASED.
//
// The reserve/commit/release counter moves are done with raw guarded SQL
// (`WHERE quantity - reserved >= $qty`) rather than Prisma's query builder,
// because the guard compares two columns to each other, which the builder
// can't express — the WHERE clause is what makes the increment atomic under
// concurrent checkouts; Postgres row-locks the matching row for the
// duration of the UPDATE, so two simultaneous holds on the last unit can
// never both succeed.
// ─────────────────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

const RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 minutes — matches Stripe Checkout Session expires_at

export function newExpiry(): Date {
  return new Date(Date.now() + RESERVATION_TTL_MS);
}

export async function getAvailableQuantity(
  tx: Tx | PrismaClient,
  variantId: string
): Promise<number> {
  const levels = await tx.inventoryLevel.findMany({ where: { variantId } });
  return levels.reduce((sum: number, l: { quantity: number; reserved: number }) => sum + (l.quantity - l.reserved), 0);
}

/**
 * Attempts to hold `quantity` units of one variant against one checkout
 * attempt, preferring whichever location has the most available stock.
 * Must run inside an existing Prisma transaction.
 */
export async function reserveInventory(
  tx: Tx,
  params: { variantId: string; quantity: number; checkoutAttemptId: string }
): Promise<{ ok: boolean; reservationId?: string }> {
  const { variantId, quantity, checkoutAttemptId } = params;

  const levels = await tx.inventoryLevel.findMany({
    where: { variantId },
    orderBy: { quantity: "desc" }
  });

  for (const level of levels) {
    const affected = await tx.$executeRaw`
      UPDATE "InventoryLevel"
      SET reserved = reserved + ${quantity}, "updatedAt" = now()
      WHERE id = ${level.id} AND quantity - reserved >= ${quantity}
    `;
    if (affected === 1) {
      const reservation = await tx.reservation.create({
        data: {
          variantId,
          locationId: level.locationId,
          quantity,
          status: ReservationStatus.ACTIVE,
          checkoutAttemptId,
          expiresAt: newExpiry()
        }
      });
      await tx.inventoryTransaction.create({
        data: {
          variantId,
          locationId: level.locationId,
          type: InventoryTransactionType.RESERVATION,
          quantityChange: 0,
          reservedChange: quantity,
          referenceType: "CheckoutAttempt",
          referenceId: checkoutAttemptId
        }
      });
      return { ok: true, reservationId: reservation.id };
    }
  }

  return { ok: false };
}

/** Releases every ACTIVE reservation for one checkout attempt (e.g. it failed or was abandoned). */
export async function releaseReservationsForAttempt(tx: Tx, checkoutAttemptId: string) {
  const reservations = await tx.reservation.findMany({
    where: { checkoutAttemptId, status: ReservationStatus.ACTIVE }
  });
  for (const r of reservations) {
    await tx.inventoryLevel.update({
      where: { variantId_locationId: { variantId: r.variantId, locationId: r.locationId } },
      data: { reserved: { decrement: r.quantity } }
    });
    await tx.reservation.update({ where: { id: r.id }, data: { status: ReservationStatus.RELEASED } });
    await tx.inventoryTransaction.create({
      data: {
        variantId: r.variantId,
        locationId: r.locationId,
        type: InventoryTransactionType.RELEASE,
        quantityChange: 0,
        reservedChange: -r.quantity,
        referenceType: "CheckoutAttempt",
        referenceId: checkoutAttemptId
      }
    });
  }
}

/** Backstop for reservations whose checkout was abandoned with no Stripe event at all. Call from a cron. */
export async function releaseExpiredReservations(prisma: PrismaClient) {
  const expired = await prisma.reservation.findMany({
    where: { status: ReservationStatus.ACTIVE, expiresAt: { lt: new Date() } }
  });
  let released = 0;
  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      // Re-check status inside the transaction in case the webhook committed
      // it in the gap between the findMany above and this write.
      const fresh = await tx.reservation.findUnique({ where: { id: r.id } });
      if (!fresh || fresh.status !== ReservationStatus.ACTIVE) return;
      await tx.inventoryLevel.update({
        where: { variantId_locationId: { variantId: fresh.variantId, locationId: fresh.locationId } },
        data: { reserved: { decrement: fresh.quantity } }
      });
      await tx.reservation.update({ where: { id: fresh.id }, data: { status: ReservationStatus.RELEASED } });
      await tx.inventoryTransaction.create({
        data: {
          variantId: fresh.variantId,
          locationId: fresh.locationId,
          type: InventoryTransactionType.RELEASE,
          quantityChange: 0,
          reservedChange: -fresh.quantity,
          referenceType: "ExpiryCron",
          referenceId: fresh.checkoutAttemptId
        }
      });
      released++;
    });
  }
  return released;
}

/**
 * Converts every ACTIVE reservation for a checkout attempt into a real
 * sale: decrements on-hand quantity, releases the reserved hold, marks the
 * reservation COMMITTED and attached to the new order.
 */
export async function commitReservationsForAttempt(
  tx: Tx,
  params: { checkoutAttemptId: string; orderId: string }
) {
  const { checkoutAttemptId, orderId } = params;
  const reservations = await tx.reservation.findMany({
    where: { checkoutAttemptId, status: ReservationStatus.ACTIVE }
  });

  for (const r of reservations) {
    await tx.inventoryLevel.update({
      where: { variantId_locationId: { variantId: r.variantId, locationId: r.locationId } },
      data: { quantity: { decrement: r.quantity }, reserved: { decrement: r.quantity } }
    });
    await tx.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.COMMITTED, orderId }
    });
    await tx.inventoryTransaction.create({
      data: {
        variantId: r.variantId,
        locationId: r.locationId,
        type: InventoryTransactionType.SALE,
        quantityChange: -r.quantity,
        reservedChange: -r.quantity,
        referenceType: "Order",
        referenceId: orderId
      }
    });
  }

  return reservations;
}

/**
 * Staff-initiated adjustment (admin inventory screen). Always logs an
 * audit transaction. `quantityChange` is a signed delta to on-hand stock.
 */
export async function adjustInventory(
  tx: Tx,
  params: {
    variantId: string;
    locationId: string;
    quantityChange: number;
    type: InventoryTransactionType;
    reason?: string;
    createdByUserId?: string;
    referenceType?: string;
    referenceId?: string;
  }
) {
  const { variantId, locationId, quantityChange, type, reason, createdByUserId, referenceType, referenceId } =
    params;

  await tx.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, quantity: Math.max(0, quantityChange) },
    update: { quantity: { increment: quantityChange } }
  });

  await tx.inventoryTransaction.create({
    data: {
      variantId,
      locationId,
      type,
      quantityChange,
      reason,
      createdByUserId,
      referenceType,
      referenceId
    }
  });
}
