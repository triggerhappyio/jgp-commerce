import { prisma } from "@/lib/prisma";

export const revalidate = 0;

// Purchasing/receiving: Supplier, PurchaseOrder, PurchaseOrderItem,
// ReceivingRecord are modeled in schema.prisma and don't depend on
// Shopify. Creation UI isn't built yet (Phase 6 in README) — read-only
// list for now.
export default async function AdminPurchasingPage() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: { supplier: true, items: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Purchasing</h1>
      <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 20 }}>
        Purchase order creation isn&apos;t wired up yet — see README &quot;Next&quot; section. The data model
        (Supplier, PurchaseOrder, PurchaseOrderItem, ReceivingRecord) is ready.
      </p>
      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "8px 0" }}>PO #</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Items</th>
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.map((po) => (
            <tr key={po.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
              <td style={{ padding: "10px 0" }}>{po.poNumber}</td>
              <td>{po.supplier.name}</td>
              <td>{po.status}</td>
              <td>{po.items.length}</td>
            </tr>
          ))}
          {purchaseOrders.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No purchase orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
