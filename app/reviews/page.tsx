export const metadata = { title: "Reviews | JGP USA" };

const reviews = [
  { name: "Ann Eggers", body: "They are surprisingly comfortable and at first feel a little heavy but soon you realize how much good support they offer.", date: "July 2026" },
  { name: "Jessica Jang", body: "What impresses me most is that my legs don't feel nearly as heavy or exhausted after long shifts anymore. They provide lasting comfort and support.", date: "July 2026" },
  { name: "lightjoyful", body: "After wearing them consistently at work, my legs and feet feel significantly less fatigued by the end of the day, and they naturally encouraged better posture.", date: "July 2026" },
  { name: "Hannah Seo", body: "I used to deal with a lot of lower back discomfort by the end of most days. After wearing my new shoes for a couple of weeks, I noticed a big difference — I feel so much better.", date: "July 2026" }
];

export default function ReviewsPage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Verified on Google · 5.0, 4 reviews</div>
        <h1>What our customers are saying.</h1>
        <p style={{ fontSize: 13, color: "var(--steel)", marginTop: 8 }}>
          These are individual customer opinions, not medical claims — results vary from person to
          person.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 24 }}>
          {reviews.map((r) => (
            <div key={r.name} className="card" style={{ padding: 24 }}>
              <div style={{ color: "var(--brass)", marginBottom: 8 }}>★★★★★</div>
              <p style={{ fontStyle: "italic" }}>&quot;{r.body}&quot;</p>
              <div style={{ fontSize: 13, color: "var(--steel)", marginTop: 12 }}>
                {r.name} — Google review · {r.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
