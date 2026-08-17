"use client";

import { useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/products";
import { useCart } from "./CartContext";

export default function ProductActions({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
      <button
        className="btn btn-primary"
        onClick={() => {
          add(product);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? "Added ✓" : "Add to Cart"}
      </button>
      <Link href="/checkout" className="btn btn-ghost">
        View Cart
      </Link>
    </div>
  );
}
