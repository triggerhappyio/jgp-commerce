import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function AdminReturnsPage() {
  const returns = await prisma.return.findMany({
    include: { order: true, items: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Returns</h1>
      <p style={{ color: "var(--steel)", fontSize: 14, marginBottom: 20 }}>
        Start a return from an order&apos;s detail page. Exchanges are same-price-only in V1 — a
        price-difference swap should be processed as a return + refund + a new separate order.
      </p>
      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "8px 0" }}>Order</th>
            <th>Status</th>
            <th>Items</th>
            <th>Requested</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
              <td style={{ padding: "10px 0" }}>
                <Link href={`/admin/returns/${r.id}`} style={{ fontWeight: 600 }}>
                  {r.order.orderNumber}
                </Link>
              </td>
              <td>{r.status}</td>
              <td>{r.items.length}</td>
              <td>{r.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
          {returns.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No returns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
