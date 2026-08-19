// Sets final cutover inventory counts from a reconciled snapshot — the
// LAST step in the migration (docs/SHOPIFY_MIGRATION.md "Launch
// sequence"), run as close to DNS cutover as practical.
//
// This does NOT add to existing counts — it sets each (SKU, location) to
// the exact reconciled quantity, logging the delta as an audited
// InventoryTransaction (never a silent raw UPDATE). Safe to re-run: running
// it twice with the same snapshot is a no-op (delta 0, no transaction
// written) for anything that didn't change.
//
// Usage:
//   npx tsx scripts/shopify-import/reconcile-inventory.ts path/to/inventory-snapshot.json
//
// Input shape — one row per (SKU, location):
// [
//   { "sku": "W852-BN-245", "location": "koreatown", "quantity": 3 },
//   { "sku": "W852-BN-245", "location": "buena-park", "quantity": 4 }
// ]
// `location` must match an existing InventoryLocation.code exactly
// (see the locations table in /admin/inventory or query InventoryLocation
// directly) — this script does not create new locations.
import { PrismaClient, InventoryTransactionType } from "@prisma/client";
import { readFileSync } from "fs";
import { adjustInventory } from "../../lib/inventory";

const prisma = new PrismaClient();

type SnapshotRow = { sku: string; location: string; quantity: number };

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/shopify-import/reconcile-inventory.ts path/to/inventory-snapshot.json");
    process.exit(1);
  }

  const rows: SnapshotRow[] = JSON.parse(readFileSync(path, "utf-8"));
  const locations = await prisma.inventoryLocation.findMany();
  const locationByCode = new Map(locations.map((l) => [l.code, l]));

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const row of rows) {
    const variant = await prisma.productVariant.findUnique({ where: { sku: row.sku } });
    if (!variant) {
      skipped++;
      console.error(`[skip] SKU ${row.sku} not found in the new catalog — import products first`);
      continue;
    }
    const location = locationByCode.get(row.location);
    if (!location) {
      skipped++;
      console.error(`[skip] location "${row.location}" not found — check InventoryLocation.code`);
      continue;
    }

    const level = await prisma.inventoryLevel.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } }
    });
    const currentQty = level?.quantity ?? 0;
    const delta = row.quantity - currentQty;

    if (delta === 0) {
      unchanged++;
      continue;
    }

    await prisma.$transaction((tx) =>
      adjustInventory(tx, {
        variantId: variant.id,
        locationId: location.id,
        quantityChange: delta,
        type: InventoryTransactionType.RECEIVING,
        reason: "Shopify migration cutover reconciliation"
      })
    );
    updated++;
  }

  console.log(`Reconciled ${updated} (SKU, location) rows, ${unchanged} already matched, ${skipped} skipped — see [skip] lines above.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
