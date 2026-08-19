import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { markReceived, inspectItem, completeReturn, rejectReturn } from "@/lib/actions/returns";

export const revalidate = 0;

const CONDITIONS = ["Sellable — restock", "Damaged — do not restock", "Defective — do not restock"];

export default async function AdminReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      order: true,
      items: { include: { orderItem: true, productVariant: { include: { product: true } } } }
    }
  });
  if (!ret) return notFound();

  const allInspected = ret.items.every((i) => i.condition);
  const exchangeVariantIds = ret.items.map((i) => i.exchangeForVariantId).filter(Boolean) as string[];
  const exchangeVariants = exchangeVariantIds.length
    ? await prisma.productVariant.findMany({ where: { id: { in: exchangeVariantIds } }, include: { product: true } })
    : [];
  const exchangeVariantById = new Map(exchangeVariants.map((v) => [v.id, v]));

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <p style={{ marginBottom: 8 }}>
        <Link href={`/admin/orders/${ret.orderId}`}>← {ret.order.orderNumber}</Link>
      </p>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Return {ret.id.slice(0, 8)}</h1>
      <p style={{ color: "var(--steel)", marginBottom: 20 }}>
        Status: <strong>{ret.status}</strong> · Requested {ret.createdAt.toLocaleString()}
        {ret.reason ? ` · ${ret.reason}` : ""}
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Items</div>
        {ret.items.map((item) => {
          const exchangeVariant = item.exchangeForVariantId ? exchangeVariantById.get(item.exchangeForVariantId) : null;
          return (
            <div key={item.id} style={{ borderTop: "1px solid var(--bone-dim)", padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>
                  {item.quantity}× {item.orderItem.productName}
                  {item.orderItem.color ? ` — ${item.orderItem.color}` : ""}
                  {item.orderItem.size ? ` (${item.orderItem.size})` : ""}
                </span>
                <span style={{ color: item.restocked ? "#1e7b34" : "var(--steel)" }}>
                  {item.restocked ? "Restocked" : "Not restocked"}
                </span>
              </div>
              {exchangeVariant && (
                <div style={{ fontSize: 13, color: "var(--brass)", marginTop: 4 }}>
                  Exchange for: {exchangeVariant.product.name} {exchangeVariant.color} {exchangeVariant.size} (same price)
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--steel)", marginTop: 4 }}>
                Condition: {item.condition ?? "Not inspected"}
              </div>

              {(ret.status === "RECEIVED" || ret.status === "INSPECTED") && !item.condition && (
                <form action={inspectItem.bind(null, ret.id, item.id)} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <select name="condition" required style={{ padding: 6, fontSize: 13 }}>
                    <option value="">Select condition…</option>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                    Record Condition
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {ret.status === "REQUESTED" && (
          <form action={markReceived.bind(null, ret.id)}>
            <button className="btn btn-brass" type="submit">
              Mark Received
            </button>
          </form>
        )}
        {ret.status === "INSPECTED" && (
          <form action={completeReturn.bind(null, ret.id)}>
            <button className="btn btn-brass" type="submit" disabled={!allInspected}>
              Complete Return
            </button>
          </form>
        )}
        {ret.status !== "RESTOCKED" && ret.status !== "REFUNDED" && ret.status !== "EXCHANGED" && ret.status !== "REJECTED" && (
          <form action={rejectReturn.bind(null, ret.id)} style={{ display: "flex", gap: 8 }}>
            <input name="reason" placeholder="Rejection reason" style={{ padding: 8, fontSize: 13 }} />
            <button className="btn btn-ghost" type="submit" style={{ color: "#b3261e" }}>
              Reject / Cancel
            </button>
          </form>
        )}
        {(ret.status === "RESTOCKED" || ret.status === "REFUNDED" || ret.status === "EXCHANGED" || ret.status === "REJECTED") && (
          <p style={{ fontSize: 13, color: "var(--steel)" }}>This return is complete — no further action available.</p>
        )}
      </div>
    </div>
  );
}
