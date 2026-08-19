"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AccountRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (signInRes?.error) {
        router.push("/account/login");
        return;
      }
      // A pre-existing guest order history is only linked after the
      // customer proves they own this email via the verification link —
      // see app/api/auth/register and app/api/auth/verify-email.
      router.push(data.verificationRequired ? "/account?checkEmail=1" : "/account");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
      setLoading(false);
    }
  };

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="eyebrow">Your Account</div>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>Create Account</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
          />
          <input
            required
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
          />
          {error && <p style={{ color: "#b3261e", fontSize: 14 }}>{error}</p>}
          <button className="btn btn-brass" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Already have an account? <Link href="/account/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
