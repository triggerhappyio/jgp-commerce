import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProductActions, { VariantOption } from "@/components/ProductActions";
import { ProductStatus } from "@prisma/client";

export const revalidate = 0; // catalog/inventory changes should show immediately

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: "Product | JGP USA" };
  return {
    title: `${product.name} | JGP USA`,
    description: product.description,
    openGraph: { title: product.name, description: product.description }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, status: ProductStatus.ACTIVE },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        where: { active: true },
        include: { inventoryLevels: true },
        orderBy: [{ color: "asc" }, { size: "asc" }]
      }
    }
  });

  if (!product) return notFound();

  const variantOptions: VariantOption[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.color,
    size: v.size,
    priceCents: v.priceCents,
    available: v.inventoryLevels.reduce((sum, l) => sum + l.quantity, 0)
  }));

  const priceCents = variantOptions[0]?.priceCents ?? 0;
  const primaryImage = product.images[0]?.url ?? null;

  const related = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, category: product.category, id: { not: product.id } },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { take: 1 } },
    take: 3
  });

  return (
    <main className="section">
      <div className="container product-detail-grid">
        <div style={{ aspectRatio: "1", background: "var(--bone-dim)", borderRadius: 2 }} />
        <div>
          <div className="eyebrow">
            {product.gender} {product.category}
          </div>
          <h1 style={{ fontSize: 36 }}>{product.name}</h1>
          <div style={{ fontSize: 22, fontFamily: "var(--font-display)", margin: "8px 0 20px" }}>
            ${(priceCents / 100).toFixed(2)}
          </div>
          <p>{product.description}</p>
          <ProductActions
            productSlug={product.slug}
            productName={product.name}
            image={primaryImage}
            variants={variantOptions}
          />
          <details style={{ marginTop: 32, fontSize: 14, color: "var(--steel)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>
              Sizing, shipping &amp; returns
            </summary>
            <p style={{ marginTop: 12 }}>
              JGP uses Korean millimeter sizing. If you&apos;re unsure of your size, visit either store
              for a free footprint analysis, or check the size guide before ordering.
            </p>
            <p>
              Standard shipping within the continental US. Unworn pairs in original packaging can be
              returned within 30 days of delivery.
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <div className="container" style={{ marginTop: 64 }}>
          <div className="eyebrow">You Might Also Like</div>
          <div className="product-grid-3" style={{ marginTop: 16 }}>
            {related.map((p) => (
              <Link key={p.slug} href={`/shop/${p.slug}`} className="card">
                <div style={{ aspectRatio: "1", background: "var(--bone-dim)" }} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "var(--steel)", fontSize: 14 }}>
                    {p.variants[0] ? `$${(p.variants[0].priceCents / 100).toFixed(2)}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
