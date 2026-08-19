import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-stats";

export const revalidate = 0;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: "var(--steel)" }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: "var(--font-display)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard label="Today's Revenue" value={`$${(stats.todayRevenueCents / 100).toFixed(2)}`} />
        <StatCard label="Orders Today" value={String(stats.ordersToday)} />
        <StatCard label="Units Sold Today" value={String(stats.unitsSoldToday)} />
        <StatCard label="Avg Order Value" value={`$${(stats.averageOrderValueCents / 100).toFixed(2)}`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Orders Awaiting Fulfillment</div>
          <div style={{ fontSize: 28, fontFamily: "var(--font-display)" }}>{stats.awaitingFulfillment}</div>
          <Link href="/admin/orders?fulfillment=UNFULFILLED" style={{ fontSize: 13 }}>
            View →
          </Link>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Sales by Location (30d)</div>
          {stats.salesByLocation.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--steel)" }}>No sales yet.</div>
          ) : (
            stats.salesByLocation.map((s) => (
              <div key={s.location} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{s.location}</span>
                <span>{s.unitsSold} units</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Low Stock Variants</div>
          {stats.lowStock.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--steel)" }}>Nothing below threshold.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                {stats.lowStock.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--bone-dim)" }}>
                    <td style={{ padding: "6px 0" }}>{v.sku}</td>
                    <td>
                      {v.productName} {v.color} {v.size}
                    </td>
                    <td style={{ textAlign: "right", color: v.available <= 0 ? "#b3261e" : "inherit" }}>
                      {v.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Top Products (30d)</div>
          {stats.topProducts.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--steel)" }}>No sales yet.</div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                {stats.topProducts.map((p) => (
                  <tr key={p.productName} style={{ borderTop: "1px solid var(--bone-dim)" }}>
                    <td style={{ padding: "6px 0" }}>{p.productName}</td>
                    <td style={{ textAlign: "right" }}>{p.unitsSold} units</td>
                    <td style={{ textAlign: "right" }}>${(p.revenueCents / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Recent Orders</div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--steel)" }}>
              <th style={{ fontWeight: 400, padding: "4px 0" }}>Order</th>
              <th style={{ fontWeight: 400 }}>Payment</th>
              <th style={{ fontWeight: 400 }}>Fulfillment</th>
              <th style={{ fontWeight: 400, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentOrders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--bone-dim)" }}>
                <td style={{ padding: "8px 0" }}>
                  <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                </td>
                <td>{o.paymentStatus}</td>
                <td>{o.fulfillmentStatus}</td>
                <td style={{ textAlign: "right" }}>${(o.totalCents / 100).toFixed(2)}</td>
              </tr>
            ))}
            {stats.recentOrders.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "12px 0", color: "var(--steel)" }}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
