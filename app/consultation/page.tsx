"use client";

import { useState } from "react";

export default function ConsultationPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <main className="section">
        <div className="container" style={{ maxWidth: 520 }}>
          <h1>Request received.</h1>
          <p>Our Tucson team will reach out to schedule your free Balance Check.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="eyebrow">Tucson · Free, 10 Minutes</div>
        <h1>Book your Balance Check.</h1>
        <p>
          A free in-store footprint analysis — no strings attached. Leave your details and our
          Tucson team will follow up to schedule.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <input required placeholder="Full name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }} />
          <input required type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }} />
          <input placeholder="Phone (optional)" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }} />
          <textarea placeholder="Anything we should know?" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2, minHeight: 80 }} />
          {status === "error" && <p style={{ color: "#b3261e" }}>Something went wrong — try again.</p>}
          <button className="btn btn-brass" disabled={status === "submitting"}>
            {status === "submitting" ? "Sending…" : "Request Balance Check"}
          </button>
        </form>
      </div>
    </main>
  );
}
