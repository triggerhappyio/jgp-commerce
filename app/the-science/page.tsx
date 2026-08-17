export const metadata = { title: "The Clinical Proof | JGP USA" };

export default function TheSciencePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Clinically Validated</div>
        <h1 style={{ maxWidth: 640 }}>The science is clear. The results are proven.</h1>
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
      </div>
    </main>
  );
}
