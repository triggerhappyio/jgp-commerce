"use client";

import { useState } from "react";
import { useCart } from "@/components/CartContext";

export default function CheckoutPage() {
  const { lines, remove, setQty, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ variantId: l.variant.variantId, qty: l.qty }))
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong starting checkout.");
      }
    } catch (e) {
      setError("Could not reach checkout. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (lines.length === 0) {
    return (
      <main className="section">
        <div className="container">
          <h1 style={{ fontSize: 32 }}>Your cart is empty</h1>
          <p>Add a pair from the collection to get started.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 32 }}>Your Cart</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "24px 0" }}>
          {lines.map((l) => (
            <div
              key={l.variant.variantId}
              className="card"
              style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{l.variant.productName}</div>
                <div style={{ color: "var(--steel)", fontSize: 14 }}>
                  {[l.variant.color, l.variant.size ? `Size ${l.variant.size}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div style={{ color: "var(--steel)", fontSize: 14 }}>
                  ${(l.variant.priceCents / 100).toFixed(2)} each
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <select
                  value={l.qty}
                  onChange={(e) => setQty(l.variant.variantId, Number(e.target.value))}
                  style={{ padding: 6, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost" onClick={() => remove(l.variant.variantId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontFamily: "var(--font-display)" }}>
          <span>Subtotal</span>
          <span>${(total / 100).toFixed(2)}</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--steel)", marginTop: 4 }}>
          Tax and shipping are calculated at checkout.
        </p>
        {error && <p style={{ color: "#b3261e" }}>{error}</p>}
        <button className="btn btn-brass" style={{ marginTop: 20, width: "100%", justifyContent: "center" }} onClick={handleCheckout} disabled={loading}>
          {loading ? "Redirecting to secure checkout…" : "Checkout with Stripe"}
        </button>
      </div>
    </main>
  );
}
