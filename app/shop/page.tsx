import Link from "next/link";
import { products } from "@/lib/products";

export const metadata = { title: "Shop | JGP USA" };

export default function ShopPage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">The Collection</div>
        <h1 style={{ fontSize: 40 }}>Every pair is built for support.</h1>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 32 }}>
          {products.map((p) => (
            <Link key={p.slug} href={`/shop/${p.slug}`} className="card">
              <div style={{ aspectRatio: "1", background: "var(--bone-dim)" }} />
              <div style={{ padding: 16 }}>
                <div className="eyebrow">{p.gender} {p.category}</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{p.name}</div>
                <div style={{ color: "var(--steel)" }}>${p.price.toFixed(2)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
