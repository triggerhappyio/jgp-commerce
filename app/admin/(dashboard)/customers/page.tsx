import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function AdminCustomersPage({
  searchParams: searchParamsPromise
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const customers = await prisma.customer.findMany({
    where: searchParams.q
      ? {
          OR: [
            { email: { contains: searchParams.q, mode: "insensitive" } },
            { name: { contains: searchParams.q, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: { orders: { select: { totalCents: true, paymentStatus: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Customers</h1>
      <form style={{ marginBottom: 20 }}>
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search name or email"
          style={{ padding: 8, border: "1px solid var(--bone-dim)", borderRadius: 2, width: 320 }}
        />
      </form>
      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "8px 0" }}>Name</th>
            <th>Email</th>
            <th>Orders</th>
            <th style={{ textAlign: "right" }}>Lifetime Spend</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const lifetimeSpend = c.orders
              .filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED")
              .reduce((s, o) => s + o.totalCents, 0);
            return (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
                <td style={{ padding: "10px 0" }}>
                  <Link href={`/admin/customers/${c.id}`}>{c.name || "—"}</Link>
                </td>
                <td>{c.email}</td>
                <td>{c.orders.length}</td>
                <td style={{ textAlign: "right" }}>${(lifetimeSpend / 100).toFixed(2)}</td>
              </tr>
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No customers match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
