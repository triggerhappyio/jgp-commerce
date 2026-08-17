import { getProduct, products } from "@/lib/products";
import { notFound } from "next/navigation";
import ProductActions from "@/components/ProductActions";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) return notFound();

  return (
    <main className="section">
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }}>
        <div style={{ aspectRatio: "1", background: "var(--bone-dim)", borderRadius: 2 }} />
        <div>
          <div className="eyebrow">{product.gender} {product.category}</div>
          <h1 style={{ fontSize: 36 }}>{product.name}</h1>
          <div style={{ fontSize: 22, fontFamily: "var(--font-display)", margin: "8px 0 20px" }}>
            ${product.price.toFixed(2)}
          </div>
          <p>{product.description}</p>
          <ProductActions product={product} />
        </div>
      </div>
    </main>
  );
}
