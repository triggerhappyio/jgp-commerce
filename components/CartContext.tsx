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
  //
  // Deliberately NOT a useState lazy initializer / useSyncExternalStore:
  // the server always renders with an empty cart (no access to
  // localStorage), so hydrating from localStorage during the initial
  // client render — rather than in a post-mount effect — would make the
  // client's first render disagree with the server-rendered HTML, which
  // React treats as a hydration error. Reading it here, one render after
  // mount, is the safe way to avoid that mismatch; the eslint-disable
  // below is for that specific, understood tradeoff, not a blanket
  // suppression.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
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
