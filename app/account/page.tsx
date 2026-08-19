import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Your Account | JGP USA" };

export default async function AccountPage({
  searchParams
}: {
  searchParams: { verified?: string; checkEmail?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/account/login");

  const customer = await prisma.customer.findUnique({
    where: { userId: (session.user as any).id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true }
      },
      footProfile: true
    }
  });

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Your Account</div>
        <h1 style={{ fontSize: 32 }}>Welcome{session.user.name ? `, ${session.user.name}` : ""}.</h1>
        <p style={{ color: "var(--steel)" }}>{session.user.email}</p>
        <SignOutButton />

        {searchParams.checkEmail && (
          <p style={{ background: "var(--bone-dim)", padding: 12, borderRadius: 2, fontSize: 14, marginTop: 16 }}>
            We found past orders under this email — check your inbox for a link to add them to your
            account.
          </p>
        )}
        {searchParams.verified && (
          <p style={{ background: "var(--bone-dim)", padding: 12, borderRadius: 2, fontSize: 14, marginTop: 16 }}>
            Your past orders have been added to your account.
          </p>
        )}

        {customer?.footProfile && (
          <div className="card" style={{ padding: 24, marginTop: 32 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Your JGP Sizing</div>
            <p style={{ fontSize: 14, color: "var(--steel)" }}>
              Preferred size: {customer.footProfile.preferredJgpSizeMm ?? "—"}mm
            </p>
          </div>
        )}

        <h2 style={{ fontSize: 22, marginTop: 40, marginBottom: 16 }}>Order History</h2>
        {!customer || customer.orders.length === 0 ? (
          <p style={{ color: "var(--steel)" }}>No orders yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {customer.orders.map((order) => (
              <div key={order.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{order.orderNumber}</div>
                  <div style={{ fontSize: 13, color: "var(--steel)" }}>
                    {order.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--steel)", marginTop: 4 }}>
                  {order.paymentStatus} · {order.fulfillmentStatus}
                  {order.trackingNumber ? ` · Tracking: ${order.trackingNumber}` : ""}
                </div>
                <div style={{ marginTop: 8 }}>
                  {order.items.map((item) => (
                    <div key={item.id} style={{ fontSize: 14 }}>
                      {item.quantity}× {item.productName}
                      {item.color ? ` — ${item.color}` : ""}
                      {item.size ? ` (${item.size})` : ""}
                    </div>
                  ))}
                </div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>${(order.totalCents / 100).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
