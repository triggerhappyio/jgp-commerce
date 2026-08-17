export const metadata = { title: "The JGP Difference | JGP USA" };

const points = [
  { title: "Posture Reinforcement", body: "Our insoles stimulate proper body alignment and core support, helping you stand taller, feel lighter, and move with intention." },
  { title: "Neurological Energy", body: "Clinically designed to stimulate nerves in the foot that connect to the spine and brain — improving circulation, energy, and mental clarity." },
  { title: "Arch Support & Recovery", body: "JGP insoles prevent flat feet, absorb stress, and redistribute weight for all-day relief, especially for long-standing or walking jobs." },
  { title: "Natural Foot Restoration", body: "Designed to reverse foot deformation caused by poor shoes, helping your feet return to their optimal structure." },
  { title: "Korean Engineering", body: "Our patented insoles and handcrafted shoes reflect the same global trust, precision, and care Korea is known for." },
  { title: "CMS Approved", body: "CMS-approved and now accepting Astiva Insurance OTC cards for easy, affordable access to premium foot health." }
];

export default function TheDifferencePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Not Just a Shoe</div>
        <h1 style={{ maxWidth: 640 }}>A device to rebuild your body.</h1>
        <p style={{ maxWidth: 620, marginBottom: 40 }}>
          We don't make soft shoes that ignore the root problem. JGP uses precise "appropriate
          firmness" to act as a casting device for your feet. By restoring your natural center of
          gravity, we instantly release neurological tension and realign your spine.
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
