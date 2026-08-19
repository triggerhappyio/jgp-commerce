// npm run reconcile:shopify -- --inventory path/to/inventory-snapshot.json
//
// READ-ONLY. Compares a Shopify export snapshot against the current
// database and prints a diff table — never writes anything. This is the
// "how far apart are we" check to run before (and, spot-check, after)
// scripts/shopify-import/reconcile-inventory.ts, which is the one script
// in this project actually allowed to change inventory counts for a
// migration. Keeping the read-only comparison and the write completely
// separate is deliberate — a script that both reports and corrects invites
// running it once and trusting the correction without ever having looked
// at the diff.
//
// Input: the same inventory-snapshot.json shape as reconcile-inventory.ts
// ([{ sku, location, quantity }]). Product/customer/order counts are
// compared by passing the same product/customer/order export files used
// for scripts/shopify-import/import-*.ts.
//
// Usage:
//   npx tsx scripts/shopify-import/reconcile-report.ts \
//     --inventory path/to/inventory-snapshot.json \
//     --products path/to/products.json \
//     --customers path/to/customers.json \
//     --orders path/to/orders.json
// All four flags are optional — only the counts you provide a file for are compared.
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";

const prisma = new PrismaClient();

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      out[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return out;
}

function loadJson<T>(path: string | undefined): T | null {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

async function main() {
  const args = parseArgs();
  console.log("\nJGP Shopify reconciliation report (READ-ONLY — no writes)\n");

  const inventorySnapshot = loadJson<{ sku: string; location: string; quantity: number }[]>(args.inventory);
  if (inventorySnapshot) {
    console.log("Inventory:");
    console.log("SKU".padEnd(20) + "Location".padEnd(14) + "Shopify qty".padEnd(14) + "JGP qty".padEnd(10) + "Diff");
    let mismatches = 0;
    for (const row of inventorySnapshot) {
      const variant = await prisma.productVariant.findUnique({ where: { sku: row.sku } });
      const location = await prisma.inventoryLocation.findUnique({ where: { code: row.location } });
      const level =
        variant && location
          ? await prisma.inventoryLevel.findUnique({
              where: { variantId_locationId: { variantId: variant.id, locationId: location.id } }
            })
          : null;
      const jgpQty = level?.quantity ?? (variant && location ? 0 : null);
      const diff = jgpQty === null ? "N/A (missing SKU or location)" : String(row.quantity - jgpQty);
      if (jgpQty === null || row.quantity !== jgpQty) mismatches++;
      console.log(row.sku.padEnd(20) + row.location.padEnd(14) + String(row.quantity).padEnd(14) + String(jgpQty ?? "—").padEnd(10) + diff);
    }
    console.log(`${mismatches} mismatch(es) out of ${inventorySnapshot.length} rows.\n`);
  }

  const productsExport = loadJson<{ handle: string }[]>(args.products);
  if (productsExport) {
    const jgpCount = await prisma.product.count();
    console.log(`Products — Shopify: ${productsExport.length}, JGP: ${jgpCount}${productsExport.length !== jgpCount ? "  MISMATCH" : ""}`);
  }

  const customersExport = loadJson<{ email: string }[]>(args.customers);
  if (customersExport) {
    const jgpCount = await prisma.customer.count();
    console.log(`Customers — Shopify: ${customersExport.length}, JGP: ${jgpCount}${customersExport.length !== jgpCount ? "  MISMATCH (some may be organic guest checkouts, not necessarily an error)" : ""}`);
  }

  const ordersExport = loadJson<{ name: string }[]>(args.orders);
  if (ordersExport) {
    const jgpCount = await prisma.order.count({ where: { legacyShopifyOrderId: { not: null } } });
    console.log(`Historical orders — Shopify: ${ordersExport.length}, JGP (legacy-tagged): ${jgpCount}${ordersExport.length !== jgpCount ? "  MISMATCH" : ""}`);
  }

  if (!inventorySnapshot && !productsExport && !customersExport && !ordersExport) {
    console.log("No export files provided — nothing to compare. See this script's header comment for usage.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
