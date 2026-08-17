export const metadata = { title: "Contact | JGP USA" };

export default function ContactPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="eyebrow">Visit or Reach Us</div>
        <h1>We're here to help.</h1>
        <div className="card" style={{ padding: 28, marginTop: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tucson Store</div>
          <p style={{ margin: 0 }}>6458 N Oracle Rd, Tucson, AZ 85704</p>
          <p style={{ margin: 0 }}>
            <a href="tel:+15204888824">(520) 488-8824</a>
          </p>
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
