"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

const links = [
  { href: "/the-truth", label: "The Truth" },
  { href: "/the-difference", label: "The Difference" },
  { href: "/the-science", label: "The Science" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" }
];

export default function Nav() {
  const { count } = useCart();
  return (
    <div className="nav">
      <div className="container nav-inner">
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>
          JGP USA
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/shop" className="btn btn-ghost">
            Shop
          </Link>
          <Link href="/checkout" className="btn btn-primary">
            Cart ({count})
          </Link>
        </div>
      </div>
    </div>
  );
}
