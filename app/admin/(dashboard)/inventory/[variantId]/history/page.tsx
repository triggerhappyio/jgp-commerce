import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function InventoryHistoryPage({ params }: { params: { variantId: string } }) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: params.variantId },
    include: { product: true }
  });
  if (!variant) return notFound();

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { variantId: params.variantId },
    include: { location: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24 }}>
        {variant.product.name} {variant.color} {variant.size}
      </h1>
      <p style={{ color: "var(--steel)", marginBottom: 20 }}>{variant.sku}</p>

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "6px 0" }}>Date</th>
            <th>Type</th>
            <th>Location</th>
            <th style={{ textAlign: "right" }}>On-hand Δ</th>
            <th style={{ textAlign: "right" }}>Reserved Δ</th>
            <th>Reference</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
              <td style={{ padding: "6px 0" }}>{t.createdAt.toLocaleString()}</td>
              <td>{t.type}</td>
              <td>{t.location.name}</td>
              <td style={{ textAlign: "right", color: t.quantityChange < 0 ? "#b3261e" : "inherit" }}>
                {t.quantityChange > 0 ? "+" : ""}
                {t.quantityChange}
              </td>
              <td style={{ textAlign: "right" }}>
                {t.reservedChange > 0 ? "+" : ""}
                {t.reservedChange}
              </td>
              <td>
                {t.referenceType ? `${t.referenceType}${t.referenceId ? ` (${t.referenceId.slice(0, 8)}…)` : ""}` : "—"}
              </td>
              <td>{t.reason ?? "—"}</td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No transactions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
