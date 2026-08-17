export const metadata = { title: "The Design Philosophy | JGP USA" };

export default function TheSciencePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Biomechanics-Informed Design</div>
        <h1 style={{ maxWidth: 640 }}>Designed with support and stability in mind.</h1>
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
        <p style={{ fontSize: 13, color: "var(--steel)", marginTop: 40, maxWidth: 560 }}>
          Design goals reflect JGP's product philosophy, not measured clinical outcomes for any
          individual. JGP footwear is not a medical device and is not intended to diagnose, treat,
          cure, or prevent any condition.
        </p>
      </div>
    </main>
  );
}
