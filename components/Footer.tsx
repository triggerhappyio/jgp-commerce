import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 40 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 12 }}>JGP USA</div>
          <p style={{ color: "var(--bone)", opacity: 0.75, maxWidth: 320 }}>
            Premium supportive footwear, engineered on biomechanics. Handcrafted in Korea. Walk steady, live active.
          </p>
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--brass)" }}>Explore</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <Link href="/the-truth">The Truth</Link>
            <Link href="/the-difference">The Difference</Link>
            <Link href="/the-science">The Science</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ color: "var(--brass)" }}>Visit Us</div>
          <p style={{ color: "var(--bone)", opacity: 0.75, marginTop: 12 }}>
            6458 N Oracle Rd, Tucson, AZ 85704
            <br />
            (520) 488-8824
          </p>
        </div>
      </div>
      <div className="container" style={{ marginTop: 48, opacity: 0.6, fontSize: 13 }}>
        © {new Date().getFullYear()} JGP USA · All rights reserved.
      </div>
    </footer>
  );
}
