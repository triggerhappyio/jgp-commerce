"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AccountLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/account");
    router.refresh();
  };

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="eyebrow">Your Account</div>
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>Sign In</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 12, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
          />
          {error && <p style={{ color: "#b3261e", fontSize: 14 }}>{error}</p>}
          <button className="btn btn-brass" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          New here? <Link href="/account/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
