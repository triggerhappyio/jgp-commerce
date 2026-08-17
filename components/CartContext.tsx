"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { Product } from "@/lib/products";

type CartLine = { product: Product; qty: number };
type CartContextType = {
  lines: CartLine[];
  add: (product: Product) => void;
  remove: (slug: string) => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = (product: Product) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.slug === product.slug);
      if (existing) {
        return prev.map((l) =>
          l.product.slug === product.slug ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const remove = (slug: string) => {
    setLines((prev) => prev.filter((l) => l.product.slug !== slug));
  };

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.product.price * l.qty, 0),
    [lines]
  );
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, add, remove, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
