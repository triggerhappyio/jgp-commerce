// Imports products/variants/images from a Shopify product export.
//
// Usage:
//   npx tsx scripts/shopify-import/import-products.ts path/to/products.json
//
// Input shape — a JSON array, one object per Shopify product (map your
// Shopify Admin API / CSV export into this shape first; field names below
// intentionally mirror Shopify's own so that mapping is close to 1:1):
//
// [{
//   "handle": "w852",                    // -> Product.slug
//   "title": "W852",                     // -> Product.name
//   "body_html": "...",                  // -> Product.description (strip HTML yourself if needed)
//   "product_type": "Sneaker",           // -> Product.category
//   "vendor": "Women's",                 // -> Product.gender — adjust the mapping below to your actual export
//   "variants": [{
//     "sku": "W852-BN-245",
//     "option1": "Black/Navy",           // -> ProductVariant.color
//     "option2": "245",                  // -> ProductVariant.size
//     "price": "350.00"                  // dollars — converted to cents
//   }],
//   "images": [{ "src": "https://cdn.shopify.com/..." }]
// }]
//
// Products always land as ProductStatus.DRAFT regardless of their Shopify
// status — a human decides when something goes live in the new system,
// never an import script. Duplicate SKUs are refused (upsert by SKU, but
// price/color/size changes on re-run are applied — safe to re-run as the
// export is refined).
import { PrismaClient, ProductStatus } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

type ShopifyVariant = { sku: string; option1?: string; option2?: string; price: string };
type ShopifyProduct = {
  handle: string;
  title: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  variants: ShopifyVariant[];
  images?: { src: string }[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/shopify-import/import-products.ts path/to/products.json");
    process.exit(1);
  }

  const products: ShopifyProduct[] = JSON.parse(readFileSync(path, "utf-8"));
  let productCount = 0;
  let variantCount = 0;
  let skippedVariants = 0;

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.handle },
      update: {
        name: p.title,
        description: p.body_html ? stripHtml(p.body_html) : "",
        category: p.product_type ?? "Uncategorized",
        gender: p.vendor ?? "Unisex"
        // status intentionally not touched on update — don't silently
        // flip an already-reviewed product back to draft on re-import.
      },
      create: {
        slug: p.handle,
        name: p.title,
        description: p.body_html ? stripHtml(p.body_html) : "",
        category: p.product_type ?? "Uncategorized",
        gender: p.vendor ?? "Unisex",
        status: ProductStatus.DRAFT
      }
    });
    productCount++;

    for (const v of p.variants) {
      if (!v.sku) {
        skippedVariants++;
        console.error(`[skip] ${p.handle}: variant with no SKU (${v.option1 ?? ""} ${v.option2 ?? ""}) — Shopify export must have SKUs assigned before import`);
        continue;
      }
      const priceCents = Math.round(Number(v.price) * 100);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        skippedVariants++;
        console.error(`[skip] ${v.sku}: invalid price "${v.price}"`);
        continue;
      }

      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: { color: v.option1 ?? null, size: v.option2 ?? null, priceCents },
        create: { productId: product.id, sku: v.sku, color: v.option1 ?? null, size: v.option2 ?? null, priceCents, active: true }
      });
      variantCount++;
    }

    for (const [i, img] of (p.images ?? []).entries()) {
      const existing = await prisma.productImage.findFirst({ where: { productId: product.id, url: img.src } });
      if (!existing) {
        await prisma.productImage.create({ data: { productId: product.id, url: img.src, alt: p.title, position: i } });
      }
    }
  }

  console.log(`Imported ${productCount} products, ${variantCount} variants (${skippedVariants} variants skipped — see [skip] lines above).`);
  console.log(`All products landed as DRAFT — review and activate via /admin/products before they appear on the storefront.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
