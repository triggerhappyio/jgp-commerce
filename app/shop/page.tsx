import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";

export const revalidate = 0;

export const metadata = { title: "Shop | JGP USA" };

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { active: true }, select: { priceCents: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">The Collection</div>
        <h1 style={{ fontSize: 40 }}>Every pair is built for support.</h1>
        <div className="product-grid-3" style={{ marginTop: 32 }}>
          {products.map((p) => {
            const prices = p.variants.map((v) => v.priceCents);
            const minPrice = prices.length ? Math.min(...prices) : 0;
            return (
              <Link key={p.slug} href={`/shop/${p.slug}`} className="card">
                <div style={{ aspectRatio: "1", background: "var(--bone-dim)" }} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "var(--steel)", fontSize: 14 }}>
                    {p.gender} {p.category}
                  </div>
                  <div style={{ color: "var(--steel)", fontSize: 14, marginTop: 4 }}>
                    ${(minPrice / 100).toFixed(2)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {products.length === 0 && (
          <p style={{ marginTop: 24, color: "var(--steel)" }}>
            No products yet — run <code>npm run db:seed</code> against a connected database.
          </p>
        )}
      </div>
    </main>
  );
}
