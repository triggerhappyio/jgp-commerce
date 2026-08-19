import { locations } from "@/lib/locations";

export const metadata = { title: "Contact | JGP USA" };

export default function ContactPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Visit or Reach Us</div>
        <h1>We&apos;re here to help.</h1>
        {locations.map((loc) => (
          <div key={loc.id} className="card" style={{ padding: 28, marginTop: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{loc.name} Store</div>
            <p style={{ margin: 0 }}>{loc.address}</p>
          </div>
        ))}
        <div className="card" style={{ padding: 28, marginTop: 24 }}>
          <p style={{ margin: 0 }}>
            <a href="mailto:gseo@jgpusa.com">gseo@jgpusa.com</a>
          </p>
          <p style={{ marginTop: 12, fontSize: 14, color: "var(--steel)" }}>
            Free in-store JGP Balance Check: a footprint analysis that takes about 10 minutes, no
            strings attached.
          </p>
        </div>
      </div>
    </main>
  );
}
