export const metadata = { title: "The JGP Difference | JGP USA" };

const points = [
  { title: "Posture-Conscious Support", body: "Our insoles are designed to support better alignment and a stable core, helping you stand taller and move with more confidence." },
  { title: "All-Day Comfort", body: "Thoughtful cushioning and structure designed to help you feel more comfortable and energized, even after hours on your feet." },
  { title: "Arch Support", body: "JGP insoles are built with reinforced arch support to help absorb impact and distribute weight evenly — ideal for long days on your feet." },
  { title: "Thoughtful Foot-First Design", body: "Designed with your foot's natural shape in mind, so your shoes work with your feet instead of against them." },
  { title: "Korean Engineering", body: "Our patented insoles and handcrafted shoes reflect the same global trust, precision, and care Korea is known for." },
  { title: "OTC Card Payment Accepted", body: "We accept Astiva Insurance OTC cards at checkout for eligible purchases — check with your plan for details." }
];

export default function TheDifferencePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Not Just a Shoe</div>
        <h1 style={{ maxWidth: 640 }}>Built different, by design.</h1>
        <p style={{ maxWidth: 620, marginBottom: 40 }}>
          We don't chase softness for its own sake. JGP uses a firmer, more structured build to give
          your feet a stable foundation — designed to support better balance and a more natural
          stance, step after step.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {points.map((p) => (
            <div key={p.title} className="card" style={{ padding: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.title}</div>
              <p style={{ fontSize: 14 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
