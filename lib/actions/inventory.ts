"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, STAFF_ROLES } from "@/lib/auth";
import { adjustInventory } from "@/lib/inventory";
import { InventoryTransactionType } from "@prisma/client";

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

const ADJUST_TYPES: string[] = [
  InventoryTransactionType.RECEIVING,
  InventoryTransactionType.MANUAL_ADJUSTMENT,
  InventoryTransactionType.DAMAGE
];

export async function adjustInventoryAction(formData: FormData) {
  const session = await requireStaff();

  const variantId = formData.get("variantId") as string;
  const locationId = formData.get("locationId") as string;
  const type = formData.get("type") as string;
  const delta = Number(formData.get("delta"));
  const reason = (formData.get("reason") as string) || undefined;

  if (!variantId || !locationId || !ADJUST_TYPES.includes(type) || !Number.isInteger(delta) || delta === 0) {
    throw new Error("Invalid inventory adjustment.");
  }

  await prisma.$transaction((tx) =>
    adjustInventory(tx, {
      variantId,
      locationId,
      quantityChange: delta,
      type: type as InventoryTransactionType,
      reason,
      createdByUserId: (session.user as any).id
    })
  );

  revalidatePath("/admin/inventory");
}

export async function transferInventoryAction(formData: FormData) {
  const session = await requireStaff();

  const variantId = formData.get("variantId") as string;
  const fromLocationId = formData.get("fromLocationId") as string;
  const toLocationId = formData.get("toLocationId") as string;
  const qty = Number(formData.get("qty"));

  if (!variantId || !fromLocationId || !toLocationId || fromLocationId === toLocationId || !(qty > 0)) {
    throw new Error("Invalid transfer.");
  }

  await prisma.$transaction(async (tx) => {
    const fromLevel = await tx.inventoryLevel.findUnique({
      where: { variantId_locationId: { variantId, locationId: fromLocationId } }
    });
    const available = (fromLevel?.quantity ?? 0) - (fromLevel?.reserved ?? 0);
    if (available < qty) {
      throw new Error("Not enough unreserved stock at the source location to transfer.");
    }

    const userId = (session.user as any).id;
    await adjustInventory(tx, {
      variantId,
      locationId: fromLocationId,
      quantityChange: -qty,
      type: InventoryTransactionType.TRANSFER,
      reason: `Transfer out to ${toLocationId}`,
      createdByUserId: userId,
      referenceType: "Transfer",
      referenceId: toLocationId
    });
    await adjustInventory(tx, {
      variantId,
      locationId: toLocationId,
      quantityChange: qty,
      type: InventoryTransactionType.TRANSFER,
      reason: `Transfer in from ${fromLocationId}`,
      createdByUserId: userId,
      referenceType: "Transfer",
      referenceId: fromLocationId
    });
  });

  revalidatePath("/admin/inventory");
}
