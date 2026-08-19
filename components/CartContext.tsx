"use client";

import { createContext, useContext, useState, useMemo, ReactNode, useEffect, useRef } from "react";
import { CartVariant } from "@/lib/types";

type CartLine = { variant: CartVariant; qty: number };
type CartContextType = {
  lines: CartLine[];
  add: (variant: CartVariant, qty?: number) => void;
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "jgp-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const hydrated = useRef(false);

  // Client-side-only cart persistence via localStorage. Fine for a guest
  // cart; a logged-in customer's cart additionally syncs to the DB (see
  // Cart/CartItem in schema.prisma) once account merge is built — see
  // README NEXT section.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore corrupt/unavailable storage
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // ignore quota/unavailable storage
    }
  }, [lines]);

  const add = (variant: CartVariant, qty: number = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variant.variantId === variant.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variant.variantId === variant.variantId ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { variant, qty }];
    });
  };

  const remove = (variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variant.variantId !== variantId));
  };

  const setQty = (variantId: string, qty: number) => {
    if (qty <= 0) return remove(variantId);
    setLines((prev) => prev.map((l) => (l.variant.variantId === variantId ? { ...l, qty } : l)));
  };

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.variant.priceCents * l.qty, 0),
    [lines]
  );
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, add, remove, setQty, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
