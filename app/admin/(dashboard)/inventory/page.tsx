import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adjustInventoryAction, transferInventoryAction } from "@/lib/actions/inventory";

export const revalidate = 0;
const LOW_STOCK_THRESHOLD = 5;

export default async function AdminInventoryPage({
  searchParams: searchParamsPromise
}: {
  searchParams: Promise<{ q?: string; location?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const [locations, variants] = await Promise.all([
    prisma.inventoryLocation.findMany({ orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      where: searchParams.q
        ? {
            OR: [
              { sku: { contains: searchParams.q, mode: "insensitive" } },
              { color: { contains: searchParams.q, mode: "insensitive" } },
              { size: { contains: searchParams.q, mode: "insensitive" } },
              { product: { name: { contains: searchParams.q, mode: "insensitive" } } }
            ]
          }
        : undefined,
      include: { product: true, inventoryLevels: { include: { location: true } } },
      orderBy: [{ product: { name: "asc" } }, { color: "asc" }, { size: "asc" }]
    })
  ]);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Inventory</h1>

      <form style={{ marginBottom: 20 }}>
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search SKU, product, color, size…"
          style={{ padding: 8, border: "1px solid var(--bone-dim)", borderRadius: 2, width: 320 }}
        />
      </form>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--steel)", borderBottom: "1px solid var(--bone-dim)" }}>
              <th style={{ padding: "8px 4px" }}>Product</th>
              <th>Color</th>
              <th>Size</th>
              <th>SKU</th>
              {locations.map((l) => (
                <th key={l.id} style={{ textAlign: "right" }}>
                  {l.name}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Available</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const levelByLocation = new Map(v.inventoryLevels.map((l) => [l.locationId, l]));
              const totalAvailable = v.inventoryLevels.reduce((s, l) => s + (l.quantity - l.reserved), 0);
              return (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--bone-dim)" }}>
                  <td style={{ padding: "8px 4px" }}>{v.product.name}</td>
                  <td>{v.color}</td>
                  <td>{v.size}</td>
                  <td style={{ color: "var(--steel)" }}>{v.sku}</td>
                  {locations.map((l) => {
                    const level = levelByLocation.get(l.id);
                    const available = (level?.quantity ?? 0) - (level?.reserved ?? 0);
                    return (
                      <td key={l.id} style={{ textAlign: "right" }}>
                        {available}
                        {level && level.reserved > 0 ? (
                          <span style={{ color: "var(--steel)" }}> ({level.reserved} held)</span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 600,
                      color: totalAvailable <= LOW_STOCK_THRESHOLD ? "#b3261e" : "inherit"
                    }}
                  >
                    {totalAvailable}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12 }}>Manage</summary>
                      <div style={{ padding: 12, minWidth: 260 }}>
                        <form action={adjustInventoryAction} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                          <input type="hidden" name="variantId" value={v.id} />
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Adjust</div>
                          <select name="locationId" style={{ padding: 6 }}>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                          <select name="type" style={{ padding: 6 }}>
                            <option value="RECEIVING">Receiving</option>
                            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                            <option value="DAMAGE">Damage</option>
                          </select>
                          <input name="delta" type="number" placeholder="+/- quantity" required style={{ padding: 6 }} />
                          <input name="reason" placeholder="Reason (optional)" style={{ padding: 6 }} />
                          <button className="btn btn-ghost" type="submit" style={{ fontSize: 12 }}>
                            Apply
                          </button>
                        </form>

                        <form action={transferInventoryAction} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input type="hidden" name="variantId" value={v.id} />
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Transfer</div>
                          <select name="fromLocationId" style={{ padding: 6 }}>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                          <select name="toLocationId" style={{ padding: 6 }}>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                          <input name="qty" type="number" min={1} placeholder="Quantity" required style={{ padding: 6 }} />
                          <button className="btn btn-ghost" type="submit" style={{ fontSize: 12 }}>
                            Transfer
                          </button>
                        </form>

                        <Link href={`/admin/inventory/${v.id}/history`} style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                          View transaction history →
                        </Link>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
