import Link from "next/link";
import { products } from "@/lib/products";
import { locations } from "@/lib/locations";

export default function Home() {
  const featured = products.slice(0, 4);
  return (
    <main>
      {/* Hero */}
      <section className="section" style={{ background: "var(--ink)", color: "var(--white)" }}>
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--brass)" }}>Premium Supportive Footwear</div>
          <h1 style={{ color: "var(--white)", maxWidth: 720 }}>Body Alignment. K-Shoe, JGP.</h1>
          <p style={{ color: "rgba(245,242,236,0.8)", maxWidth: 480, fontSize: 17 }}>
            More than shoes — footwear engineered with biomechanics-informed design to support better
            posture and help you feel steadier, step after step. Trusted by 20,000+ customers.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
            <Link href="/shop" className="btn btn-brass">Shop the Revolution →</Link>
            <Link href="#locations" className="btn" style={{ borderColor: "var(--bone)", color: "var(--white)" }}>
              Visit Our Stores
            </Link>
          </div>
        </div>
      </section>

      {/* Hidden culprit */}
      <section className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <div className="eyebrow">Why Shoes Matter More Than You Think</div>
          <h2>Think it's just fatigue? Look at your shoes.</h2>
          <p>
            Heavy legs, a stiff lower back, and end-of-day exhaustion aren't only about getting older.
            Soft, unstable footwear can make your body work harder just to stay balanced — and over a
            long day, that adds up. Your shoes might be working against you.
          </p>
          <Link href="/the-truth" className="btn btn-ghost" style={{ marginTop: 12 }}>
            Discover Why It Matters →
          </Link>
        </div>
      </section>

      {/* Design philosophy */}
      <section className="section-tight" style={{ background: "var(--white)" }}>
        <div className="container">
          <div className="eyebrow">Biomechanics-Informed Design</div>
          <h2>Designed with support and stability in mind.</h2>
          <p style={{ maxWidth: 560, marginBottom: 40 }}>
            Developed in consultation with biomechanics research from Chonnam National University —
            because good design should be grounded in how the body actually moves.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { stat: "Stride", label: "Efficiency-Focused Design", sub: "Built to support a more natural, efficient step" },
              { stat: "Core", label: "Stability-Conscious Build", sub: "Encourages engagement through a stable base" },
              { stat: "Posture", label: "Alignment-Aware Construction", sub: "Designed with posture and balance in mind" }
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: 28 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--brass)" }}>
                  {s.stat}
                </div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>{s.label}</div>
                <div style={{ color: "var(--steel)", fontSize: 14 }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <Link href="/the-science" className="btn btn-ghost" style={{ marginTop: 32 }}>
            See the Design Philosophy →
          </Link>
        </div>
      </section>

      {/* Featured products */}
      <section className="section">
        <div className="container">
          <div className="eyebrow">Most Popular</div>
          <h2>Shop the collection</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 24 }}>
            {featured.map((p) => (
              <Link key={p.slug} href={`/shop/${p.slug}`} className="card">
                <div style={{ aspectRatio: "1", background: "var(--bone-dim)" }} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "var(--steel)", fontSize: 14 }}>${p.price.toFixed(2)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Store locations */}
      <section id="locations" className="section-tight" style={{ background: "var(--ink)", color: "var(--white)" }}>
        <div className="container">
          <h2 style={{ color: "var(--white)" }}>Step into true comfort.</h2>
          <p style={{ color: "rgba(245,242,236,0.8)", maxWidth: 520 }}>
            Visit one of our stores for a free footprint analysis and experience our 10-second
            in-store balance check for yourself.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 24, gap: 24 }}>
            {locations.map((loc) => (
              <div key={loc.id}>
                <div style={{ fontWeight: 600, color: "var(--brass)" }}>{loc.name}</div>
                <p style={{ color: "var(--bone)", marginTop: 8 }}>{loc.address}</p>
                <a
                  className="btn btn-brass"
                  style={{ marginTop: 8 }}
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get Directions
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
