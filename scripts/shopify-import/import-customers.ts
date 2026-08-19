// Imports customers + addresses from a Shopify customer export.
//
// Usage:
//   npx tsx scripts/shopify-import/import-customers.ts path/to/customers.json
//
// Input shape:
// [{
//   "email": "jane@example.com",
//   "first_name": "Jane",
//   "last_name": "Doe",
//   "phone": "+15551234567",
//   "addresses": [{
//     "first_name": "Jane", "last_name": "Doe",
//     "address1": "123 Main St", "address2": "",
//     "city": "Los Angeles", "province_code": "CA", "zip": "90006",
//     "country_code": "US", "phone": "", "default": true
//   }]
// }]
//
// Passwords are NEVER imported — Shopify does not export password hashes,
// and even if it did, this app uses a different hashing scheme (bcrypt).
// Every imported record is a Customer (commerce profile) with no linked
// User (login) — customers register normally post-cutover and their
// history attaches automatically via the same verified-email claim flow
// as an organic guest checkout (app/api/auth/register). Do not try to
// "migrate" a login; there is nothing crossable to migrate.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

type ShopifyAddress = {
  first_name?: string;
  last_name?: string;
  address1: string;
  address2?: string;
  city: string;
  province_code?: string;
  zip: string;
  country_code?: string;
  phone?: string;
  default?: boolean;
};
type ShopifyCustomer = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  addresses?: ShopifyAddress[];
};

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/shopify-import/import-customers.ts path/to/customers.json");
    process.exit(1);
  }

  const customers: ShopifyCustomer[] = JSON.parse(readFileSync(path, "utf-8"));
  let customerCount = 0;
  let addressCount = 0;
  let skipped = 0;

  for (const c of customers) {
    const email = c.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || undefined;

    const customer = await prisma.customer.upsert({
      where: { email },
      update: { name, phone: c.phone ?? undefined },
      create: { email, name, phone: c.phone ?? undefined }
    });
    customerCount++;

    for (const a of c.addresses ?? []) {
      if (!a.address1 || !a.city || !a.zip) continue;
      await prisma.address.create({
        data: {
          customerId: customer.id,
          type: "SHIPPING",
          firstName: a.first_name ?? c.first_name ?? "",
          lastName: a.last_name ?? c.last_name ?? "",
          line1: a.address1,
          line2: a.address2 || undefined,
          city: a.city,
          state: a.province_code ?? "",
          postalCode: a.zip,
          country: a.country_code ?? "US",
          phone: a.phone || undefined,
          isDefault: a.default ?? false
        }
      });
      addressCount++;
    }
  }

  console.log(`Imported ${customerCount} customers, ${addressCount} addresses (${skipped} rows skipped — missing email).`);
  console.log(`No passwords were imported and none exist to import — see script header comment.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
