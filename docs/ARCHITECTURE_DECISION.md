# ADR: Commerce Core — Custom (Next.js + PostgreSQL + Prisma) vs. Medusa

Date: 2026-08-17
Status: Decided — revisit if transaction volume, team size, or return/exchange
complexity grows materially beyond what's described here.

## Repository state at time of decision

Before deciding, audited what actually exists (not what was planned):

- **Product/Variant**: real Prisma models (`Product`, `ProductVariant`,
  `ProductImage`), but functionally flat — one variant per product,
  `sku == slug` as a placeholder, no real size/color splitting yet.
- **Cart**: `CartContext.tsx` — client-only React state, no persistence, no
  variant selection, no reservation.
- **Order**: single `status` string, no split state machines, no order
  number, no tax/shipping breakdown, `shippingAddress` as loose `Json`.
- **Inventory**: single `inventoryQty` int per variant. No locations, no
  transaction log, decrement is an unguarded `{ decrement: qty }` — can go
  negative under concurrent orders. No reservation lifecycle.
- **Stripe**: checkout session created with inline `price_data`; webhook
  handles only `checkout.session.completed`, dedups via `Order.stripeSessionId`
  uniqueness (works for that one event type, but no `StripeEvent` audit
  table, no handling of `checkout.session.expired` or async payment events).
- **Returns/exchanges**: nonexistent.
- **Admin**: nonexistent — no `/admin` routes at all.
- **Auth**: nonexistent — no `User` model, no session handling.
- **Live data**: none. No DATABASE_URL, no Stripe keys configured anywhere.
  Storefront still reads a static `lib/products.ts` array; the DB-backed
  checkout/webhook code has never run against a live database.

**Migration cost right now is low.** There is no live database, no admin UI,
no auth, and no real order history to preserve. What would be discarded by
switching to Medusa: `CartContext`'s local logic (would call Medusa's Store
API instead), the current `Product`/`Order`/`OrderItem` Prisma models
(Medusa would own these), and the checkout/webhook routes (replaced by
Medusa's Stripe payment provider + its own webhook handling). The marketing
pages, Nav/Footer, and visual identity are unaffected either way.

## Options considered

**A. Custom Next.js + PostgreSQL + Prisma** (continue current path), now with
the rigor this ADR's companion requirements impose: reservation-based
inventory, split state machines, integer-cents money, a Stripe event
idempotency table, a shipping/tax provider abstraction.

**B. Medusa (commerce core) + custom Next.js storefront**, with JGP-specific
extensions (Foot Profile, sizing history) layered on top.

## Decision

**A — stay custom.**

## Why

1. **Deployment shape.** Medusa v2 is a persistent Node server with a hard
   Redis dependency for its workflow/event engine in production — it isn't a
   Vercel serverless function. Adopting it means running and operating a
   second backend service (Railway/Render/Fly/Medusa Cloud) plus Redis, on
   top of the Next.js app on Vercel. That's a materially larger operational
   footprint for a two-location footwear retailer than "one Next.js app, one
   Postgres instance, one Vercel project."
2. **JGP's actual differentiator doesn't fit cleanly on top of Medusa.** The
   stated long-term goal is Foot Profile → JGP size knowledge → product
   match → purchase history → fit feedback, all tied tightly together. That
   flow wants `Customer`, `Order`, `Product`, and `FootProfile` in one
   relational schema with real foreign keys. Under Medusa, commerce tables
   belong to Medusa/MikroORM and FootProfile would have to live in a
   separate Prisma-owned schema, joined only by copied IDs — reintroducing
   a two-ORM, two-migration-system split at exactly the point where tight
   relational integrity matters most.
3. **Low switching cost doesn't mean switching is free going forward.** It's
   cheap to switch *today* because nothing's live — but the cost that
   matters is what's paid *after* adopting Medusa: learning its v2
   module/workflow API, running/upgrading a second service indefinitely, and
   maintaining the ID-mapping seam to the JGP-owned tables. For a catalog
   this size, that ongoing cost outweighs the primitives gained.
4. This matches the explicit standing instruction from the original spec to
   avoid microservices/distributed architecture "until there is a
   demonstrated reason to add complexity" — no such reason exists yet.

## Tradeoffs (what we're giving up by not choosing Medusa)

- No free, already-built admin dashboard — the JGP `/admin` (dashboard,
  orders, inventory, products, customers) has to be built and maintained
  by hand.
- No pre-built returns/exchange workflow — must be modeled and built here.
- No pre-built multi-region/multi-currency or tax-provider plugin system —
  addressed with a thin `TaxProvider`/`ShippingProvider` abstraction
  instead (see below), starting with Stripe Tax.
- No battle-tested inventory-reservation engine — reservation lifecycle
  (below) is our own, and needs to be gotten right rather than inherited.
- If JGP's order volume or SKU count grows an order of magnitude, or a
  second brand under the same admin becomes a real near-term need, this
  decision is worth revisiting — Medusa's overhead amortizes better at
  that scale.

## What we own

Everything: `Product`, `ProductVariant`, `ProductImage`, `InventoryLocation`,
`InventoryLevel`, `InventoryTransaction`, `Reservation`, `Customer`/`User`,
`Address`, `FootProfile`, `Order`, `OrderItem`, `Payment`, `Refund`,
`Shipment`, `Return`, `ReturnItem`, `Supplier`, `PurchaseOrder`,
`PurchaseOrderItem`, `ReceivingRecord`, `StripeEvent` — one Postgres
database, one Prisma schema, one Next.js app, deployed as one Vercel
project.

## What the commerce engine owns

N/A under this decision — there is no separate commerce engine. Stripe
remains the payment processor (Checkout Sessions + webhooks + Stripe Tax),
not a commerce backend; it never sees or stores anything beyond what's
needed to process a charge.
