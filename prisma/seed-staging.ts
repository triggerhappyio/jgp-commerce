// npm run db:seed:staging
//
// Deterministic STAGING-ONLY seed. Refuses to run when appEnv() is
// "production" — this is not the dev catalog seed (prisma/seed.ts, which
// is also dev/staging-only but larger and pseudo-random); this one exists
// specifically to give a predictable fixture for the runtime commerce
// tests and manual staging walkthroughs: one product, one color, three
// sizes with deliberately different stock states.
//
// Staff/admin/customer passwords are randomly generated on each run and
// printed to the console — never hardcoded, never committed. Re-running
// this script rotates them; write down what it prints if you need to log
// in as that user again, or just re-run it.
import { PrismaClient, ProductStatus, Role, InventoryTransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { appEnv } from "../lib/env";

const prisma = new PrismaClient();

function randomPassword(): string {
  return randomBytes(12).toString("base64url"); // ~16 chars, URL-safe, easy to read back off a terminal
}

async function upsertStaffUser(email: string, role: Role, label: string) {
  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, passwordHash, role, name: label }
  });
  console.log(`${label.padEnd(10)} ${email.padEnd(28)} password: ${password}`);
}

async function main() {
  const env = appEnv();
  if (env === "production") {
    console.error("Refusing to run db:seed:staging against a production environment (appEnv() === \"production\").");
    process.exit(1);
  }

  console.log(`\nSeeding staging fixture data (environment: ${env})...\n`);

  // ── Location ─────────────────────────────────────────────────────────
  const location = await prisma.inventoryLocation.upsert({
    where: { code: "STAGING" },
    update: {},
    create: { code: "STAGING", name: "Staging Warehouse", isDefault: true }
  });

  // ── Product: W852, Black/Navy, three sizes with distinct stock states ──
  const product = await prisma.product.upsert({
    where: { slug: "w852" },
    update: { status: ProductStatus.ACTIVE },
    create: {
      slug: "w852",
      name: "W852",
      description: "Staging fixture product — signature JGP silhouette, Black/Navy.",
      category: "Sneaker",
      gender: "Women's",
      status: ProductStatus.ACTIVE
    }
  });

  const variantSpecs: { size: string; sku: string; onHand: number; label: string }[] = [
    { size: "240", sku: "W852-BN-240", onHand: 12, label: "in-stock" },
    { size: "245", sku: "W852-BN-245", onHand: 1, label: "low-stock" },
    { size: "250", sku: "W852-BN-250", onHand: 0, label: "sold-out" }
  ];

  for (const spec of variantSpecs) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: spec.sku },
      update: { active: true, priceCents: 35000 },
      create: { productId: product.id, sku: spec.sku, color: "Black/Navy", size: spec.size, priceCents: 35000, active: true }
    });

    const existingLevel = await prisma.inventoryLevel.findUnique({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } }
    });
    if (existingLevel) {
      await prisma.inventoryLevel.update({ where: { id: existingLevel.id }, data: { quantity: spec.onHand, reserved: 0 } });
    } else {
      await prisma.inventoryLevel.create({ data: { variantId: variant.id, locationId: location.id, quantity: spec.onHand, reserved: 0 } });
      await prisma.inventoryTransaction.create({
        data: {
          variantId: variant.id,
          locationId: location.id,
          type: InventoryTransactionType.RECEIVING,
          quantityChange: spec.onHand,
          reason: "Staging seed — initial stock"
        }
      });
    }
    console.log(`Variant ${spec.sku} (${spec.label}): on-hand = ${spec.onHand}`);
  }

  // ── Users ────────────────────────────────────────────────────────────
  console.log("");
  await upsertStaffUser("staging-admin@jgpusa.test", Role.ADMIN, "ADMIN");
  await upsertStaffUser("staging-staff@jgpusa.test", Role.STAFF, "STAFF");

  const customerPassword = randomPassword();
  const customerHash = await bcrypt.hash(customerPassword, 12);
  const customerUser = await prisma.user.upsert({
    where: { email: "staging-customer@jgpusa.test" },
    update: { passwordHash: customerHash, role: Role.CUSTOMER },
    create: { email: "staging-customer@jgpusa.test", passwordHash: customerHash, role: Role.CUSTOMER, name: "Staging Customer" }
  });
  await prisma.customer.upsert({
    where: { email: "staging-customer@jgpusa.test" },
    update: { userId: customerUser.id },
    create: { email: "staging-customer@jgpusa.test", userId: customerUser.id, name: "Staging Customer" }
  });
  console.log(`CUSTOMER    staging-customer@jgpusa.test    password: ${customerPassword}`);

  console.log("\nDone. Passwords above are only shown this once — re-run this script to rotate them if lost.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
