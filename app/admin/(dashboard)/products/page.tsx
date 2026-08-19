import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { variants: { include: { inventoryLevels: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>Products</h1>
        <Link href="/admin/products/new" className="btn btn-brass">
          New Product
        </Link>
      </div>

      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
            <th style={{ padding: "8px 0" }}>Name</th>
            <th>Status</th>
            <th>Category</th>
            <th>Variants</th>
            <th style={{ textAlign: "right" }}>Total Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const totalStock = p.variants.reduce(
              (sum, v) => sum + v.inventoryLevels.reduce((s, l) => s + (l.quantity - l.reserved), 0),
              0
            );
            return (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
                <td style={{ padding: "10px 0" }}>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.status}</td>
                <td>
                  {p.gender} {p.category}
                </td>
                <td>{p.variants.length}</td>
                <td style={{ textAlign: "right" }}>{totalStock}</td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "16px 0", color: "var(--steel)" }}>
                No products yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
