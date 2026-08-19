import { prisma } from "@/lib/prisma";

const LOW_STOCK_THRESHOLD = 5;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// All figures come straight from Order/OrderItem/InventoryTransaction
// aggregates — nothing here is a mock/placeholder value.
export async function getDashboardStats() {
  const todayStart = startOfToday();

  const [todayOrders, awaitingFulfillment, recentOrders, lowStockVariants, topProductRows, salesByLocationRows] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, paymentStatus: "PAID" },
        include: { items: true }
      }),
      prisma.order.count({
        where: { paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED" }
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { items: true }
      }),
      prisma.productVariant.findMany({
        where: { active: true },
        include: { product: true, inventoryLevels: true }
      }),
      prisma.orderItem.groupBy({
        by: ["productName"],
        where: { order: { createdAt: { gte: daysAgo(30) }, paymentStatus: "PAID" } },
        _sum: { quantity: true, totalCents: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5
      }),
      prisma.inventoryTransaction.groupBy({
        by: ["locationId"],
        where: { type: "SALE", createdAt: { gte: daysAgo(30) } },
        _sum: { quantityChange: true }
      })
    ]);

  const todayRevenueCents = todayOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const unitsSoldToday = todayOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const averageOrderValueCents = todayOrders.length ? Math.round(todayRevenueCents / todayOrders.length) : 0;

  const lowStock = lowStockVariants
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      productName: v.product.name,
      color: v.color,
      size: v.size,
      available: v.inventoryLevels.reduce((s, l) => s + (l.quantity - l.reserved), 0)
    }))
    .filter((v) => v.available <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.available - b.available)
    .slice(0, 10);

  const locations = await prisma.inventoryLocation.findMany();
  const locationById = new Map(locations.map((l) => [l.id, l.name]));
  const salesByLocation = salesByLocationRows
    .map((r) => ({
      location: locationById.get(r.locationId) ?? "Unknown",
      unitsSold: Math.abs(r._sum.quantityChange ?? 0)
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  return {
    todayRevenueCents,
    ordersToday: todayOrders.length,
    unitsSoldToday,
    averageOrderValueCents,
    awaitingFulfillment,
    recentOrders,
    lowStock,
    topProducts: topProductRows.map((r) => ({
      productName: r.productName,
      unitsSold: r._sum.quantity ?? 0,
      revenueCents: r._sum.totalCents ?? 0
    })),
    salesByLocation
  };
}
