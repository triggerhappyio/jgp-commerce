import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const revalidate = 0;

export default async function AdminOrdersPage({
  searchParams: searchParamsPromise
}: {
  searchParams: Promise<{ q?: string; fulfillment?: string; payment?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const where: Prisma.OrderWhereInput = {};
  if (searchParams.fulfillment) where.fulfillmentStatus = searchParams.fulfillment as any;
  if (searchParams.payment) where.paymentStatus = searchParams.payment as any;
  if (searchParams.q) {
    where.OR = [
      { orderNumber: { contains: searchParams.q, mode: "insensitive" } },
      { email: { contains: searchParams.q, mode: "insensitive" } }
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true }
  });

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Orders</h1>

      <form style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search order # or email"
          style={{ padding: 8, border: "1px solid var(--bone-dim)", borderRadius: 2, flex: 1 }}
        />
        <select name="fulfillment" defaultValue={searchParams.fulfillment ?? ""} style={{ padding: 8 }}>
          <option value="">Any fulfillment</option>
          <option value="UNFULFILLED">Unfulfilled</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select name="payment" defaultValue={searchParams.payment ?? ""} style={{ padding: 8 }}>
          <option value="">Any payment</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <button className="btn btn-brass" type="submit">
          Filter
        </button>
      </form>

      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "8px 0" }}>Order</th>
            <th>Email</th>
            <th>Items</th>
            <th>Payment</th>
            <th>Fulfillment</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
              <td style={{ padding: "10px 0" }}>
                <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
              </td>
              <td>{o.email}</td>
              <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
              <td>{o.paymentStatus}</td>
              <td>{o.fulfillmentStatus}</td>
              <td style={{ textAlign: "right" }}>${(o.totalCents / 100).toFixed(2)}</td>
              <td>{o.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No orders match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
