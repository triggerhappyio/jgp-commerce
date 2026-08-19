import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, STAFF_ROLES } from "@/lib/auth";

// Defense in depth: middleware.ts already redirects unauthenticated/wrong-
// role requests away from /admin/**, but that check runs against the JWT
// only. This second, server-side check runs on every request to an actual
// admin page/layout and is what the spec means by "hiding navigation links
// is not adequate security" — it fails closed even if middleware config
// ever drifts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || !STAFF_ROLES.includes(role)) {
    redirect("/admin/login");
  }

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/products", label: "Products" },
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/returns", label: "Returns" },
    { href: "/admin/purchasing", label: "Purchasing" }
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "var(--ink)", color: "var(--white)", padding: 24, flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 32 }}>JGP Admin</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: "rgba(245,242,236,0.85)", padding: "8px 10px", borderRadius: 4, fontSize: 14 }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 40, fontSize: 12, opacity: 0.6 }}>
          Signed in as {session.user.email}
          <br />
          Role: {role}
        </div>
      </aside>
      <div style={{ flex: 1, background: "var(--white)", minWidth: 0 }}>{children}</div>
    </div>
  );
}
