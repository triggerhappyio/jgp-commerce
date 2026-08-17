import Link from "next/link";
import { locations } from "@/lib/locations";

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
          {locations.map((loc) => (
            <p key={loc.id} style={{ color: "var(--bone)", opacity: 0.75, marginTop: 12 }}>
              <strong>{loc.name}</strong>
              <br />
              {loc.address}
            </p>
          ))}
        </div>
      </div>
      <div className="container" style={{ marginTop: 24, opacity: 0.6, fontSize: 12, maxWidth: 720 }}>
        JGP footwear is designed for everyday comfort and support. It is not a medical device and is
        not intended to diagnose, treat, cure, or prevent any condition. For medical concerns,
        consult a healthcare professional.
      </div>
      <div className="container" style={{ marginTop: 16, opacity: 0.6, fontSize: 13 }}>
        © {new Date().getFullYear()} JGP USA · All rights reserved.
      </div>
    </footer>
  );
}
