"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { deleteProductImage } from "@/lib/storage";
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

  const productId = await prisma.$transaction(
    async (tx) => {
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
    },
    // colors x sizes x locations sequential queries — a modestly-sized
    // catalog entry (e.g. 3 colors x 5 sizes x 3 locations = 15 variants x
    // ~5 queries each = 75 round trips) comfortably exceeds Prisma's
    // 5000ms default against a real remote database. Same class of bug as
    // the webhook/checkout fixes — found once here, applied everywhere
    // the shape recurs rather than waiting to hit it again per call site.
    { timeout: 30000 }
  );

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

// Attaches an already-uploaded blob URL to a product. The upload itself
// (auth check, file-type/size validation) happens in
// app/api/admin/upload-image/route.ts — this action only ever runs after
// a real object already exists in storage; it never accepts an arbitrary
// client-supplied URL as a substitute for actually uploading a file.
export async function attachProductImage(productId: string, url: string) {
  await requireStaff();
  const existingCount = await prisma.productImage.count({ where: { productId } });
  await prisma.productImage.create({
    data: { productId, url, alt: "", position: existingCount }
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function removeProductImage(imageId: string, productId: string) {
  await requireStaff();
  const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } });
  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteProductImage(image.url);
  revalidatePath(`/admin/products/${productId}`);
}

// Swap with the previous image's position — simple, safe adjacent-swap
// reordering rather than a full drag-and-drop list.
export async function moveProductImageUp(imageId: string, productId: string) {
  await requireStaff();
  const images = await prisma.productImage.findMany({ where: { productId }, orderBy: { position: "asc" } });
  const index = images.findIndex((img) => img.id === imageId);
  if (index <= 0) return; // already first, or not found
  const [current, previous] = [images[index], images[index - 1]];
  await prisma.$transaction([
    prisma.productImage.update({ where: { id: current.id }, data: { position: previous.position } }),
    prisma.productImage.update({ where: { id: previous.id }, data: { position: current.position } })
  ]);
  revalidatePath(`/admin/products/${productId}`);
}
