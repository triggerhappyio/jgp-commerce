// Imports historical orders from a Shopify order export as read-only
// history — never replays inventory effects (see "Inventory" section of
// docs/SHOPIFY_MIGRATION.md: final inventory comes from a separate
// reconciliation snapshot, reconcile-inventory.ts, not from replaying
// every historical order).
//
// Usage:
//   npx tsx scripts/shopify-import/import-orders.ts path/to/orders.json
//
// Input shape:
// [{
//   "name": "#1042",                      // Shopify's order number -> legacyShopifyOrderId
//   "email": "jane@example.com",
//   "created_at": "2025-11-03T12:00:00Z",
//   "financial_status": "paid",           // paid | refunded | partially_refunded | pending | voided
//   "line_items": [{ "sku": "W852-BN-245", "title": "W852", "quantity": 1, "price": "350.00" }],
//   "subtotal_price": "350.00",
//   "total_tax": "0.00",
//   "total_shipping_price_set": { "shop_money": { "amount": "8.00" } },
//   "total_price": "358.00"
// }]
//
// Line items are stored as immutable snapshots (productName/sku/price
// captured directly from the export), same as every OrderItem created by
// the live checkout flow — matching product data is looked up only to
// link productVariantId where the SKU still exists in the new catalog,
// never to recompute price/name from current data.
import { PrismaClient, PaymentStatus, OrderSource } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

type ShopifyLineItem = { sku: string; title: string; quantity: number; price: string };
type ShopifyOrder = {
  name: string;
  email: string;
  created_at: string;
  financial_status: string;
  line_items: ShopifyLineItem[];
  subtotal_price: string;
  total_tax?: string;
  total_shipping_price_set?: { shop_money: { amount: string } };
  total_price: string;
};

function centsFrom(dollarString: string | undefined): number {
  return Math.round(Number(dollarString ?? "0") * 100);
}

function mapFinancialStatus(status: string): PaymentStatus {
  switch (status) {
    case "paid":
      return PaymentStatus.PAID;
    case "refunded":
      return PaymentStatus.REFUNDED;
    case "partially_refunded":
      return PaymentStatus.PARTIALLY_REFUNDED;
    case "voided":
      return PaymentStatus.CANCELLED;
    default:
      return PaymentStatus.PENDING;
  }
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/shopify-import/import-orders.ts path/to/orders.json");
    process.exit(1);
  }

  const orders: ShopifyOrder[] = JSON.parse(readFileSync(path, "utf-8"));
  let imported = 0;
  let skipped = 0;

  for (const o of orders) {
    const legacyShopifyOrderId = o.name;
    const existing = await prisma.order.findFirst({ where: { legacyShopifyOrderId } });
    if (existing) {
      skipped++;
      continue; // idempotent — safe to re-run
    }

    const email = o.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      console.error(`[skip] order ${legacyShopifyOrderId}: no email`);
      continue;
    }

    const customer = await prisma.customer.upsert({
      where: { email },
      update: {},
      create: { email }
    });

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: null, // legacy orders keep their Shopify number as legacyShopifyOrderId, not a new JGP-##### number
          customerId: customer.id,
          email,
          subtotalCents: centsFrom(o.subtotal_price),
          taxCents: centsFrom(o.total_tax),
          shippingCents: centsFrom(o.total_shipping_price_set?.shop_money.amount),
          totalCents: centsFrom(o.total_price),
          paymentStatus: mapFinancialStatus(o.financial_status),
          fulfillmentStatus: "DELIVERED", // historical orders are assumed already fulfilled — adjust if your export has real fulfillment data
          legacyShopifyOrderId,
          source: OrderSource.SHOPIFY_HISTORICAL,
          createdAt: new Date(o.created_at)
        }
      });

      for (const li of o.line_items) {
        const variant = li.sku ? await tx.productVariant.findUnique({ where: { sku: li.sku } }) : null;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productVariantId: variant?.id, // null if the SKU doesn't exist in the new catalog — the snapshot fields below still make the row meaningful
            productName: li.title,
            sku: li.sku ?? "UNKNOWN",
            unitPriceCents: centsFrom(li.price),
            quantity: li.quantity,
            totalCents: centsFrom(li.price) * li.quantity
          }
        });
      }
    });

    imported++;
  }

  console.log(`Imported ${imported} historical orders (${skipped} skipped — already imported or missing email).`);
  console.log(`No inventory was moved by this import — see docs/SHOPIFY_MIGRATION.md and reconcile-inventory.ts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
