import Link from "next/link";
import { products } from "@/lib/products";

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
            Certified health tools, not just shoes — restoring posture, reducing pain and fatigue, and
            reviving your natural alignment. Backed by 20,000+ cases.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
            <Link href="/shop" className="btn btn-brass">Shop the Revolution →</Link>
            <Link href="#tucson" className="btn" style={{ borderColor: "var(--bone)", color: "var(--white)" }}>
              Visit Tucson Store
            </Link>
          </div>
        </div>
      </section>

      {/* Hidden culprit */}
      <section className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <div className="eyebrow">The Hidden Culprit</div>
          <h2>Think it's just fatigue? Look at your shoes.</h2>
          <p>
            Heavy legs, a stiff lower back, and constant exhaustion aren't just part of getting older.
            They're the direct result of your brain fighting to keep you balanced on overly soft,
            unstable shoes. Your body is overworking, and your footwear is the hidden culprit.
          </p>
          <Link href="/the-truth" className="btn btn-ghost" style={{ marginTop: 12 }}>
            Discover the Hidden Cause →
          </Link>
        </div>
      </section>

      {/* Clinical proof */}
      <section className="section-tight" style={{ background: "var(--white)" }}>
        <div className="container">
          <div className="eyebrow">Clinically Validated</div>
          <h2>The science is clear. The results are proven.</h2>
          <p style={{ maxWidth: 560, marginBottom: 40 }}>
            Clinically validated by Chonnam National University Biomechanics Lab.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { stat: "+3.4 in", label: "Stride Length Increased", sub: "Dynamic walking efficiency" },
              { stat: "+5.0%", label: "Core Strength Enhanced", sub: "Maximized kinetic power transfer" },
              { stat: "Alignment", label: "Posture Corrected", sub: "Reduced forward head posture" }
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
            See the Clinical Proof →
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

      {/* Tucson store */}
      <section id="tucson" className="section-tight" style={{ background: "var(--ink)", color: "var(--white)" }}>
        <div className="container">
          <h2 style={{ color: "var(--white)" }}>Tucson, step into true comfort.</h2>
          <p style={{ color: "rgba(245,242,236,0.8)", maxWidth: 520 }}>
            Visit our Tucson location for a free footprint analysis and experience the 10-second balance
            miracle for yourself.
          </p>
          <p style={{ color: "var(--bone)", marginTop: 16 }}>6458 N Oracle Rd, Tucson, AZ 85704</p>
          <a
            className="btn btn-brass"
            style={{ marginTop: 8 }}
            href="https://www.google.com/maps/dir/?api=1&destination=6458%20N%20Oracle%20Rd%2C%20Tucson%2C%20AZ%2085704"
            target="_blank"
            rel="noreferrer"
          >
            Get Directions
          </a>
        </div>
      </section>
    </main>
  );
}
