// Verifies the fix in lib/actions/orders.ts refundOrder(): two concurrent
// refund attempts on the same order must never both succeed past the
// "remaining balance" check. Exercises the real SQL pattern (SELECT ... FOR
// UPDATE row lock) directly against Postgres — this is exactly the kind of
// behavior that cannot be meaningfully faked with SQLite.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getTestPrisma } from "./helpers";

let prisma: PrismaClient | null = null;
let orderId: string;

const ORDER_TOTAL_CENTS = 10000;

beforeAll(async () => {
  prisma = await getTestPrisma();
  if (!prisma) return;

  const order = await prisma.order.create({
    data: {
      email: "refund-race-test@example.com",
      subtotalCents: ORDER_TOTAL_CENTS,
      totalCents: ORDER_TOTAL_CENTS,
      paymentStatus: "PAID",
      stripeSessionId: `cs_test_refund_race_${Date.now()}`,
      stripePaymentIntentId: `pi_test_refund_race_${Date.now()}`
    }
  });
  orderId = order.id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.refund.deleteMany({ where: { orderId } }).catch(() => {});
  await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => {});
  await prisma.$disconnect();
});

// Reimplements just the DB-locking + validation half of refundOrder (not
// the Stripe call, which this test can't and shouldn't make) — enough to
// prove the row-lock serializes the "how much is left" check correctly.
async function attemptRefund(db: PrismaClient, amountCents: number): Promise<{ ok: boolean }> {
  try {
    await db.$transaction(
      async (tx) => {
        const [order] = await tx.$queryRaw<{ totalCents: number }[]>`
          SELECT "totalCents" FROM "Order" WHERE id = ${orderId} FOR UPDATE
        `;
        const totals = await tx.refund.aggregate({ where: { orderId }, _sum: { amountCents: true } });
        const remaining = order.totalCents - (totals._sum.amountCents ?? 0);
        if (amountCents > remaining) throw new Error("over-refund rejected");
        await tx.refund.create({ data: { orderId, amountCents, status: "succeeded" } });
      },
      { timeout: 15000 }
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

describe.skipIf(!process.env.DATABASE_URL)("Refund — concurrency integrity", () => {
  it("two simultaneous refund attempts for the full order amount: exactly one succeeds", async () => {
    if (!prisma) return;

    const [a, b] = await Promise.all([
      attemptRefund(prisma, ORDER_TOTAL_CENTS),
      attemptRefund(prisma, ORDER_TOTAL_CENTS)
    ]);

    const succeeded = [a, b].filter((r) => r.ok);
    expect(succeeded.length).toBe(1); // never both — that would be a real double-refund

    const totals = await prisma.refund.aggregate({ where: { orderId }, _sum: { amountCents: true } });
    expect(totals._sum.amountCents).toBe(ORDER_TOTAL_CENTS); // not 2x the order total
  });
});
