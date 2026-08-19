import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateFulfillment, cancelOrder, refundOrder } from "@/lib/actions/orders";

export const revalidate = 0;

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, payments: true, refunds: true, shipments: true, customer: true }
  });

  if (!order) return notFound();

  const totalRefunded = order.refunds.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div style={{ padding: 32, maxWidth: 880 }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{order.orderNumber}</h1>
      <p style={{ color: "var(--steel)", marginBottom: 24 }}>
        Placed {order.createdAt.toLocaleString()} · {order.email}
        {order.phone ? ` · ${order.phone}` : ""}
      </p>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Items</div>
            {order.items.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderTop: "1px solid var(--bone-dim)" }}>
                <span>
                  {item.quantity}× {item.productName}
                  {item.color ? ` — ${item.color}` : ""}
                  {item.size ? ` (${item.size})` : ""}
                  <span style={{ color: "var(--steel)" }}> · {item.sku}</span>
                </span>
                <span>${(item.totalCents / 100).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--bone-dim)", marginTop: 8, paddingTop: 8 }}>
              <Row label="Subtotal" value={order.subtotalCents} />
              <Row label="Tax" value={order.taxCents} />
              <Row label="Shipping" value={order.shippingCents} />
              <Row label="Total" value={order.totalCents} bold />
              {totalRefunded > 0 && <Row label="Refunded" value={-totalRefunded} />}
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Fulfillment</div>
            <form action={updateFulfillment.bind(null, order.id)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 13 }}>
                Status
                <select name="fulfillmentStatus" defaultValue={order.fulfillmentStatus} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
                  <option value="UNFULFILLED">Unfulfilled</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label style={{ fontSize: 13 }}>
                Carrier
                <input name="carrier" defaultValue={order.carrier ?? ""} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Tracking Number
                <input name="trackingNumber" defaultValue={order.trackingNumber ?? ""} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Internal Notes
                <textarea name="notes" defaultValue={order.notes ?? ""} style={{ display: "block", width: "100%", padding: 8, marginTop: 4, minHeight: 60 }} />
              </label>
              <button className="btn btn-brass" type="submit">
                Save
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Refund</div>
            <form action={refundOrder.bind(null, order.id)} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label style={{ fontSize: 13, flex: 1 }}>
                Amount (cents, blank = full)
                <input name="amountCents" type="number" placeholder={String(order.totalCents - totalRefunded)} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 13, flex: 1 }}>
                Reason
                <input name="reason" style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
              </label>
              <button className="btn btn-ghost" type="submit" disabled={order.paymentStatus === "REFUNDED"}>
                Issue Refund
              </button>
            </form>
            <form action={cancelOrder.bind(null, order.id)} style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" type="submit" style={{ color: "#b3261e" }}>
                Cancel Order
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Status</div>
            <div style={{ fontSize: 14 }}>Payment: {order.paymentStatus}</div>
            <div style={{ fontSize: 14 }}>Fulfillment: {order.fulfillmentStatus}</div>
            <div style={{ fontSize: 14 }}>Order: {order.status}</div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Shipping Address</div>
            <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
              {order.shippingAddress ? JSON.stringify(order.shippingAddress, null, 2) : "—"}
            </pre>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Stripe</div>
            <div style={{ fontSize: 12, color: "var(--steel)", wordBreak: "break-all" }}>
              Session: {order.stripeSessionId}
              <br />
              Payment Intent: {order.stripePaymentIntentId ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: bold ? 600 : 400 }}>
      <span>{label}</span>
      <span>${(value / 100).toFixed(2)}</span>
    </div>
  );
}
