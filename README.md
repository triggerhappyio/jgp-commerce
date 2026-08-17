# JGP USA — Unified Site

Replaces `jgpusa.com` + `jgpfootwear.store` (Shopify) with a single
JGP-owned codebase: marketing content, catalog, cart, Stripe checkout,
and a verified-webhook order pipeline into Postgres.

## Accounts you need before launch (not something I can create for you)

| Need | Provider | Why |
|---|---|---|
| Payments | Stripe (business account) | Checkout + webhook order capture |
| Database | Neon or Supabase (Postgres) | Products, orders, customers, consultation leads |
| Hosting | Vercel | Native Next.js hosting, pairs with either DB provider |
| DNS | Wherever jgpusa.com is registered | Point domain at Vercel at cutover |
| Email | Resend or Postmark | Order receipts, consultation-lead notifications |
| Shopify admin | Existing account | Export catalog + customers + order history for migration |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Stripe + DATABASE_URL
npx prisma migrate dev --name init
npm run dev
```

For Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
(the CLI prints a `whsec_...` — put that in `.env.local`).

## What's implemented

- Full site: home, The Truth / The Difference / The Science / Reviews /
  Contact / Consultation.
- Shop + product pages seeded from the live Shopify catalog (swap in real
  photography before launch).
- Working cart, Stripe Checkout Session creation (`app/api/checkout`).
- **Verified Stripe webhook** (`app/api/webhooks/stripe`) — this, not the
  client, is the only place an `Order` gets written. Checks Stripe's
  signature, is idempotent on `stripeSessionId`, upserts the `Customer`.
- **Prisma schema** (`prisma/schema.prisma`) — Product, ProductVariant,
  ProductImage, Customer, Order, OrderItem, Consultation. This is the
  target data model; the storefront currently reads products from the
  static `lib/products.ts` file as a bridge until catalog migration (below)
  is done.
- Consultation ("Balance Check") lead form, saved to Postgres.

## Migration order (do these in sequence)

1. **Export from Shopify** — Products/variants, Customers, Orders (Shopify
   Admin → Settings → Exports, or the Admin API for a cleaner pull).
2. **Catalog migration** — write a one-off script that reads the Shopify
   export and inserts into `Product` / `ProductVariant` / `ProductImage`.
   Once this is done, swap `lib/products.ts` reads for Prisma queries in
   `app/shop/page.tsx` and `app/shop/[slug]/page.tsx`.
3. **Wire the webhook to the real catalog** — once variants exist in
   Postgres, replace the `getProduct()` lookup in the webhook with real
   `ProductVariant` lookups by SKU, and decrement `inventoryQty`
   transactionally inside the webhook handler.
4. **Customer + order history migration** — import for support lookup;
   keep `legacyShopifyOrderId` populated so old order numbers still resolve.
5. **Shipping** — Shippo or EasyPost for rates/labels/tracking, triggered
   from the webhook once an order is marked paid.
6. **Tax** — Stripe Tax (simplest — turn on in the Stripe dashboard,
   attach `automatic_tax: { enabled: true }` to the Checkout Session).
7. **Accounts** — passwordless auth (e.g. NextAuth email magic links) for
   order history and saved addresses.
8. **Admin dashboard** — protected `/admin` for products, inventory,
   orders, consultation leads. Not built yet — next priority after
   catalog migration.
9. **SEO** — 301 redirect map from the old jgpusa.com/jgpfootwear.store
   URLs to the new structure before DNS cutover, plus product schema
   markup and a sitemap.
10. **Claims review** — every health/medical claim on The Truth / The
    Difference / The Science pages should go through legal/compliance
    review before this goes live under the JGP name (same review Le Bal
    routes through Triggerhappy.io — worth using the same process here).

## Deploying

Push to GitHub, import into Vercel, set `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, and `DATABASE_URL` as environment variables. Add
the deployed webhook URL (`https://yourdomain.com/api/webhooks/stripe`) in
the Stripe dashboard once live, and copy that endpoint's signing secret
into `STRIPE_WEBHOOK_SECRET`.

## Security notes (the "safety/security netting")

- Stripe handles card data end-to-end (Checkout is PCI SAQ-A) — this app
  never touches raw card numbers.
- The webhook verifies Stripe's signature before writing anything —
  nobody can fake a "paid" order by hitting the endpoint directly.
- Prices are computed server-side from the catalog, never trusted from
  the client cart.
- Environment secrets (`STRIPE_SECRET_KEY`, `DATABASE_URL`,
  `STRIPE_WEBHOOK_SECRET`) live only in Vercel's environment variables —
  never commit `.env.local`.
