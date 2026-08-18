import { PrismaClient } from "@prisma/client";
import { products } from "../lib/products";

// One-off catalog migration: reads the static bridge catalog in lib/products.ts
// and inserts it into Postgres. Idempotent — safe to re-run.
//
// NOTE: this seeds one ProductVariant per Product with sku = slug, since
// lib/products.ts doesn't model size/color variants separately. Once you have
// the real Shopify export, replace this with a script that reads the export
// and creates one Product with multiple ProductVariant rows (real SKUs,
// sizes, colors, and real inventory counts) per README's migration order.

const prisma = new PrismaClient();

async function main() {
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        category: p.category,
        gender: p.gender
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        gender: p.gender
      }
    });

    await prisma.productVariant.upsert({
      where: { sku: p.slug },
      update: {
        priceCents: Math.round(p.price * 100)
      },
      create: {
        productId: product.id,
        sku: p.slug,
        priceCents: Math.round(p.price * 100),
        // Placeholder count so nothing shows out-of-stock immediately.
        // Replace with real counts from the Shopify export before launch.
        inventoryQty: 25
      }
    });

    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, position: 0 }
    });
    if (!existingImage) {
      await prisma.productImage.create({
        data: { productId: product.id, url: p.image, alt: p.name, position: 0 }
      });
    }

    console.log(`Seeded ${p.slug}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
