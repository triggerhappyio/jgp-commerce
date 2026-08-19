"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { CartVariant } from "@/lib/types";

export type VariantOption = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  priceCents: number;
  available: number;
};

export default function ProductActions({
  productSlug,
  productName,
  image,
  variants
}: {
  productSlug: string;
  productName: string;
  image: string | null;
  variants: VariantOption[];
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter((c): c is string => !!c))),
    [variants]
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);

  const sizesForColor = useMemo(
    () => variants.filter((v) => v.color === selectedColor),
    [variants, selectedColor]
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(sizesForColor[0]?.size ?? null);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.color === selectedColor && v.size === selectedSize) ?? null,
    [variants, selectedColor, selectedSize]
  );

  const [qty, setQty] = useState(1);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const first = variants.find((v) => v.color === color);
    setSelectedSize(first?.size ?? null);
    setQty(1);
  };

  const inStock = (selectedVariant?.available ?? 0) > 0;
  const maxQty = Math.min(selectedVariant?.available ?? 0, 10);

  const handleAdd = () => {
    if (!selectedVariant || !inStock) return;
    const cartVariant: CartVariant = {
      variantId: selectedVariant.id,
      productSlug,
      productName,
      sku: selectedVariant.sku,
      color: selectedVariant.color,
      size: selectedVariant.size,
      priceCents: selectedVariant.priceCents,
      image
    };
    add(cartVariant, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div style={{ marginTop: 24 }}>
      {colors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Color</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                className="btn btn-ghost"
                style={{
                  padding: "8px 14px",
                  borderColor: color === selectedColor ? "var(--brass)" : "var(--bone-dim)",
                  fontWeight: color === selectedColor ? 600 : 400
                }}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizesForColor.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Size (mm)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sizesForColor.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.available <= 0}
                onClick={() => {
                  setSelectedSize(v.size);
                  setQty(1);
                }}
                className="btn btn-ghost"
                style={{
                  padding: "8px 14px",
                  minWidth: 48,
                  borderColor: v.size === selectedSize ? "var(--brass)" : "var(--bone-dim)",
                  fontWeight: v.size === selectedSize ? 600 : 400,
                  opacity: v.available <= 0 ? 0.35 : 1,
                  textDecoration: v.available <= 0 ? "line-through" : "none"
                }}
              >
                {v.size}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: inStock ? "var(--steel)" : "#b3261e", marginBottom: 16 }}>
        {selectedVariant
          ? inStock
            ? `${selectedVariant.available} in stock`
            : "Out of stock in this size"
          : "Select a color and size"}
      </div>

      {inStock && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <label htmlFor="qty" style={{ fontSize: 13, fontWeight: 600 }}>
            Qty
          </label>
          <select
            id="qty"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ padding: 8, border: "1px solid var(--bone-dim)", borderRadius: 2 }}
          >
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" onClick={handleAdd} disabled={!inStock || !selectedVariant}>
          {added ? "Added ✓" : inStock ? "Add to Cart" : "Out of Stock"}
        </button>
        <Link href="/checkout" className="btn btn-ghost">
          View Cart
        </Link>
      </div>
    </div>
  );
}
