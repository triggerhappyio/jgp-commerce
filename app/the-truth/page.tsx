export const metadata = { title: "The Truth About Shoes | JGP USA" };

export default function TheTruthPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Why Shoes Matter More Than You Think</div>
        <h1>Think it's just fatigue? Look at your shoes.</h1>
        <p>
          Heavy legs, a stiff lower back, and end-of-day exhaustion aren't only about getting older.
          Soft, unstable footwear can make your body work harder just to stay balanced — and over a
          long day, that adds up. Your shoes might be working against you.
        </p>
        <p>
          Many modern shoes prioritize softness over stability. That extra softness can mean your
          stabilizing muscles do more work with every step — which, for some people, shows up as
          added fatigue or tension by the end of the day.
        </p>
        <p style={{ fontSize: 13, color: "var(--steel)", marginTop: 24 }}>
          This is general information about footwear design, not medical advice. If you're
          experiencing persistent pain, talk to a healthcare professional.
        </p>
      </div>
    </main>
  );
}
