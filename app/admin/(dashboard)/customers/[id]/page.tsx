import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
      addresses: true,
      footProfile: true,
      returns: true
    }
  });
  if (!customer) return notFound();

  const lifetimeSpend = customer.orders
    .filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED")
    .reduce((s, o) => s + o.totalCents, 0);

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 26 }}>{customer.name || customer.email}</h1>
      <p style={{ color: "var(--steel)" }}>
        {customer.email}
        {customer.phone ? ` · ${customer.phone}` : ""}
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--steel)" }}>Lifetime Spend</div>
          <div style={{ fontSize: 22, fontFamily: "var(--font-display)" }}>${(lifetimeSpend / 100).toFixed(2)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--steel)" }}>Orders</div>
          <div style={{ fontSize: 22, fontFamily: "var(--font-display)" }}>{customer.orders.length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--steel)" }}>Returns</div>
          <div style={{ fontSize: 22, fontFamily: "var(--font-display)" }}>{customer.returns.length}</div>
        </div>
      </div>

      {customer.footProfile && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>JGP Foot Profile</div>
          <div style={{ fontSize: 14 }}>
            Left: {customer.footProfile.leftFootLengthMm ?? "—"}mm · Right:{" "}
            {customer.footProfile.rightFootLengthMm ?? "—"}mm
          </div>
          <div style={{ fontSize: 14 }}>Preferred JGP size: {customer.footProfile.preferredJgpSizeMm ?? "—"}mm</div>
        </div>
      )}

      {customer.notes && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Staff Notes</div>
          <div style={{ fontSize: 14 }}>{customer.notes}</div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Order History</div>
        {customer.orders.map((o) => (
          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--bone-dim)", fontSize: 14 }}>
            <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
            <span>{o.paymentStatus}</span>
            <span>${(o.totalCents / 100).toFixed(2)}</span>
          </div>
        ))}
        {customer.orders.length === 0 && <div style={{ fontSize: 14, color: "var(--steel)" }}>No orders yet.</div>}
      </div>
    </div>
  );
}
