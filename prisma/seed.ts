import { PrismaClient, ProductStatus, InventoryTransactionType } from "@prisma/client";

// Development/demo catalog seed — NOT production data. Structured the way
// the real Shopify export migration (see README) should ultimately land:
// one Product per style, one ProductVariant per color+size, inventory
// spread across real locations with an audit trail from the first unit in.

const prisma = new PrismaClient();

const LOCATIONS = [
  { name: "Koreatown", code: "KTOWN", address: "3250 W Olympic Blvd #3F, Los Angeles, CA 90006", isDefault: true },
  { name: "Buena Park", code: "BP", address: "6281 Beach Blvd #106, Buena Park, CA 90621", isDefault: false },
  { name: "Warehouse", code: "WH", address: null, isDefault: false },
  { name: "Online", code: "ONLINE", address: null, isDefault: false }
];

const MENS_SIZES = ["240", "245", "250", "255", "260", "265", "270"];
const WOMENS_SIZES = ["220", "225", "230", "235", "240", "245", "250"];

type SeedVariant = {
  color: string;
  size: string;
  priceCents: number;
  // [Koreatown, Buena Park, Warehouse, Online]
  stock: [number, number, number, number];
};

type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  gender: "Men's" | "Women's" | "Unisex";
  description: string;
  variants: SeedVariant[];
};

// Simple deterministic pseudo-random stock generator so re-running the seed
// produces the same numbers (idempotent), seeded off the SKU string.
function stockFor(sku: string): [number, number, number, number] {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = (h * 31 + sku.charCodeAt(i)) % 97;
  return [h % 6, (h * 3) % 9, (h * 5) % 14, (h * 2) % 5];
}

function buildVariants(colors: string[], sizes: string[], priceCents: number): SeedVariant[] {
  const out: SeedVariant[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      out.push({ color, size, priceCents, stock: stockFor(`${color}-${size}`) });
    }
  }
  return out;
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "w852",
    name: "W852",
    category: "Sneaker",
    gender: "Women's",
    description: "The signature JGP women's silhouette. Natural-BaL Technology insole in a clean, everyday sneaker build.",
    variants: [
      // Exact figures from the internal inventory example this schema was
      // designed around — kept literal so the admin inventory table matches
      // the reference numbers on first seed.
      { color: "Black/Navy", size: "240", priceCents: 35000, stock: [3, 4, 9, 2] },
      { color: "Black/Navy", size: "245", priceCents: 35000, stock: [1, 6, 7, 3] },
      { color: "Black/Navy", size: "250", priceCents: 35000, stock: [0, 4, 11, 1] },
      ...buildVariants(["Black/Navy"], ["220", "225", "230", "235", "255"], 35000),
      ...buildVariants(["White/Pink"], WOMENS_SIZES, 35000)
    ]
  },
  {
    slug: "m808",
    name: "M808",
    category: "Sneaker",
    gender: "Men's",
    description: "The signature JGP men's silhouette. Natural-BaL Technology insole in a clean, everyday sneaker build.",
    variants: buildVariants(["White", "Black"], MENS_SIZES, 35000)
  },
  {
    slug: "mw851d",
    name: "MW851D Trekking",
    category: "Trekking",
    gender: "Unisex",
    description: "Built for long-standing days and uneven ground, with reinforced arch and heel support.",
    variants: buildVariants(["Grey/Orange"], [...MENS_SIZES, "275"], 40000)
  },
  {
    slug: "m701n",
    name: "M701N Buckle Loafer",
    category: "Loafer",
    gender: "Men's",
    description: "Formal-ready loafer, handcrafted in Korea, with the full Natural-BaL insole system.",
    variants: buildVariants(["Black", "Brown"], MENS_SIZES.slice(0, 6), 40000)
  }
];

async function seedLocations() {
  const byCode: Record<string, string> = {};
  for (const loc of LOCATIONS) {
    const row = await prisma.inventoryLocation.upsert({
      where: { code: loc.code },
      update: { name: loc.name, address: loc.address ?? undefined, isDefault: loc.isDefault },
      create: loc
    });
    byCode[loc.code] = row.id;
  }
  return byCode;
}

async function seedProducts(locationIdByCode: Record<string, string>) {
  const locationOrder: [string, string, string, string] = ["KTOWN", "BP", "WH", "ONLINE"];

  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        category: p.category,
        gender: p.gender,
        status: ProductStatus.ACTIVE
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        gender: p.gender,
        status: ProductStatus.ACTIVE
      }
    });

    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, position: 0 }
    });
    if (!existingImage) {
      await prisma.productImage.create({
        data: { productId: product.id, url: `/products/${p.slug}.jpg`, alt: p.name, position: 0 }
      });
    }

    for (const v of p.variants) {
      const sku = `${p.name.split(" ")[0].toUpperCase()}-${v.color.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase()}-${v.size}`;

      const variant = await prisma.productVariant.upsert({
        where: { sku },
        update: { priceCents: v.priceCents, color: v.color, size: v.size, active: true },
        create: {
          productId: product.id,
          sku,
          color: v.color,
          size: v.size,
          priceCents: v.priceCents,
          active: true
        }
      });

      for (let i = 0; i < locationOrder.length; i++) {
        const code = locationOrder[i];
        const locationId = locationIdByCode[code];
        const qty = v.stock[i];

        const level = await prisma.inventoryLevel.findUnique({
          where: { variantId_locationId: { variantId: variant.id, locationId } }
        });

        // Idempotent: only write the initial RECEIVING transaction once.
        if (!level) {
          await prisma.$transaction([
            prisma.inventoryLevel.create({
              data: { variantId: variant.id, locationId, quantity: qty }
            }),
            prisma.inventoryTransaction.create({
              data: {
                variantId: variant.id,
                locationId,
                type: InventoryTransactionType.RECEIVING,
                quantityChange: qty,
                reason: "Initial seed stock",
                referenceType: "Seed"
              }
            })
          ]);
        }
      }
    }

    console.log(`Seeded ${p.slug} (${p.variants.length} variants)`);
  }
}

async function main() {
  const locationIdByCode = await seedLocations();
  await seedProducts(locationIdByCode);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
