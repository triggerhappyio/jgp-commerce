import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProductDetails, updateProductStatus, addVariant, toggleVariantActive } from "@/lib/actions/products";
import { ProductStatus } from "@prisma/client";

export const revalidate = 0;

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { include: { inventoryLevels: true }, orderBy: [{ color: "asc" }, { size: "asc" }] } }
  });
  if (!product) return notFound();

  const setStatus = async (status: ProductStatus) => {
    "use server";
    await updateProductStatus(product.id, status);
  };

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 26 }}>{product.name}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {product.status !== "ACTIVE" && (
            <form action={setStatus.bind(null, ProductStatus.ACTIVE)}>
              <button className="btn btn-brass" type="submit">
                Activate
              </button>
            </form>
          )}
          {product.status !== "ARCHIVED" && (
            <form action={setStatus.bind(null, ProductStatus.ARCHIVED)}>
              <button className="btn btn-ghost" type="submit">
                Archive
              </button>
            </form>
          )}
        </div>
      </div>
      <p style={{ color: "var(--steel)" }}>
        /shop/{product.slug} · {product.status}
      </p>

      <form action={updateProductDetails.bind(null, product.id)} className="card" style={{ padding: 20, marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 13 }}>
          Name
          <input name="name" defaultValue={product.name} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Description
          <textarea name="description" defaultValue={product.description} style={{ display: "block", width: "100%", padding: 8, marginTop: 4, minHeight: 70 }} />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ fontSize: 13, flex: 1 }}>
            Category
            <input name="category" defaultValue={product.category} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13, flex: 1 }}>
            Gender
            <input name="gender" defaultValue={product.gender} style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
          </label>
        </div>
        <button className="btn btn-ghost" type="submit" style={{ alignSelf: "flex-start" }}>
          Save Details
        </button>
      </form>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Variants</div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--steel)" }}>
              <th style={{ padding: "4px 0" }}>SKU</th>
              <th>Color</th>
              <th>Size</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => {
              const stock = v.inventoryLevels.reduce((s, l) => s + (l.quantity - l.reserved), 0);
              const toggle = async () => {
                "use server";
                await toggleVariantActive(v.id, product.id, !v.active);
              };
              return (
                <tr key={v.id} style={{ borderTop: "1px solid var(--bone-dim)" }}>
                  <td style={{ padding: "6px 0" }}>{v.sku}</td>
                  <td>{v.color}</td>
                  <td>{v.size}</td>
                  <td style={{ textAlign: "right" }}>${(v.priceCents / 100).toFixed(2)}</td>
                  <td style={{ textAlign: "right" }}>{stock}</td>
                  <td>
                    <form action={toggle}>
                      <button className="btn btn-ghost" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>
                        {v.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form action={addVariant.bind(null, product.id)} style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "flex-end" }}>
          <label style={{ fontSize: 12 }}>
            Color
            <input name="color" style={{ display: "block", padding: 6 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Size (mm)
            <input name="size" style={{ display: "block", padding: 6 }} />
          </label>
          <label style={{ fontSize: 12 }}>
            Price (USD)
            <input name="price" type="number" step="0.01" required style={{ display: "block", padding: 6 }} />
          </label>
          <button className="btn btn-ghost" type="submit" style={{ fontSize: 12 }}>
            Add Variant
          </button>
        </form>
      </div>
    </div>
  );
}
