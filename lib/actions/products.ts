"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { ProductStatus } from "@prisma/client";

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function skuFor(productName: string, color: string, size: string) {
  const colorCode = color.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "STD";
  const productCode = productName.split(" ")[0].toUpperCase();
  return `${productCode}-${colorCode}-${size}`;
}

export async function createProduct(formData: FormData) {
  await requireStaff();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const gender = (formData.get("gender") as string)?.trim();
  const priceDollars = Number(formData.get("price"));
  const colors = (formData.get("colors") as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const sizes = (formData.get("sizes") as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name || !description || !category || !gender || !Number.isFinite(priceDollars) || priceDollars <= 0) {
    throw new Error("Missing or invalid required fields.");
  }
  if (colors.length === 0 || sizes.length === 0) {
    throw new Error("At least one color and one size are required.");
  }

  const slug = slugify(name);
  const priceCents = Math.round(priceDollars * 100);

  const locations = await prisma.inventoryLocation.findMany();

  const productId = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: { slug, name, description, category, gender, status: ProductStatus.DRAFT }
    });

    for (const color of colors) {
      for (const size of sizes) {
        const sku = skuFor(name, color, size);
        const existing = await tx.productVariant.findUnique({ where: { sku } });
        if (existing) {
          throw new Error(`SKU ${sku} already exists — adjust colors/sizes to avoid a collision.`);
        }
        const variant = await tx.productVariant.create({
          data: { productId: product.id, sku, color, size, priceCents, active: true }
        });
        for (const location of locations) {
          await tx.inventoryLevel.create({ data: { variantId: variant.id, locationId: location.id, quantity: 0 } });
        }
      }
    }

    return product.id;
  });

  revalidatePath("/admin/products");
  redirect(`/admin/products/${productId}`);
}

export async function updateProductStatus(productId: string, status: ProductStatus) {
  await requireStaff();
  await prisma.product.update({ where: { id: productId }, data: { status } });
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
}

export async function updateProductDetails(productId: string, formData: FormData) {
  await requireStaff();
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const gender = (formData.get("gender") as string)?.trim();

  if (!name || !description || !category || !gender) {
    throw new Error("Missing required fields.");
  }

  await prisma.product.update({ where: { id: productId }, data: { name, description, category, gender } });
  revalidatePath(`/admin/products/${productId}`);
}

export async function addVariant(productId: string, formData: FormData) {
  await requireStaff();

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const color = (formData.get("color") as string)?.trim() || null;
  const size = (formData.get("size") as string)?.trim() || null;
  const priceDollars = Number(formData.get("price"));

  if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
    throw new Error("Invalid price.");
  }

  const sku = skuFor(product.name, color ?? "STD", size ?? "OS");
  const existing = await prisma.productVariant.findUnique({ where: { sku } });
  if (existing) {
    throw new Error(`SKU ${sku} already exists.`);
  }

  const locations = await prisma.inventoryLocation.findMany();

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: { productId, sku, color, size, priceCents: Math.round(priceDollars * 100), active: true }
    });
    for (const location of locations) {
      await tx.inventoryLevel.create({ data: { variantId: variant.id, locationId: location.id, quantity: 0 } });
    }
  });

  revalidatePath(`/admin/products/${productId}`);
}

export async function toggleVariantActive(variantId: string, productId: string, active: boolean) {
  await requireStaff();
  await prisma.productVariant.update({ where: { id: variantId }, data: { active } });
  revalidatePath(`/admin/products/${productId}`);
}
