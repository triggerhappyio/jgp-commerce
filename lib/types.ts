// Plain, client-safe shapes shared between server components and client
// components (CartContext, ProductActions). Deliberately NOT the Prisma
// generated types — those pull in server-only code and shouldn't leak into
// the client bundle.

export type CartVariant = {
  variantId: string;
  productSlug: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  priceCents: number;
  image: string | null;
};
