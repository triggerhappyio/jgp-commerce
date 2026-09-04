# JGP USA — Production Commerce Platform

A full-replacement commerce backend for `jgpfootwear.store` / `jgpusa.store`
— own Postgres, own Stripe integration, own admin system. Not headless
Shopify, not a prototype. This README explains the architecture, how to run
it, and exactly what's left before it can go live.

## Architecture

```
Customer → jgpfootwear.store / jgpusa.store → Vercel → Next.js (App Router)
                                                   │
                        ┌──────────────┬───────────┼───────────┬─────────────┐
                        ▼              ▼           ▼           ▼             ▼
                    Stripe         Postgres     Storage      Email      Auth.js (JWT)
                   (Checkout,    (Prisma —      (not yet     (not yet   Credentials +
                    webhooks,     product,       wired —      wired —    role-based
                    refunds)      inventory,     see below)   see below) /admin gate
                                  orders,
                                  customers,
                                  returns, POs)
```

- **Next.js 14 (App Router) + TypeScript**, deployed to Vercel.
- **Postgres via Prisma** — see `prisma/schema.prisma` for the full model
  (Product/Variant/Image, multi-location Inventory + reservations,
  Customer/Address/FootProfile, Order/Payment/Refund/Shipment,
  Return/ReturnItem, Supplier/PurchaseOrder/ReceivingRecord, User/Auth).
- **Stripe Checkout** (hosted redirect flow) for payment; webhook is the
  only writer of `Order` rows.
- **Auth.js v5** (Credentials + JWT sessions) for both staff (`/admin`) and
  customer (`/account`) auth, role-gated (`CUSTOMER/STAFF/MANAGER/ADMIN/SUPER_ADMIN`).
- **No object storage or email provider wired in yet** — see "Not built
  yet" below. The architecture doesn't lock you into a specific one:
  product images are already a `url` string field, and email sending is
  meant to live in a not-yet-created `lib/email.ts` so nothing else has to
  change when you pick a provider.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Without `DATABASE_URL` set, the marketing pages (`/the-truth`,
`/the-difference`, `/the-science`, `/reviews`, `/contact`) still work —
everything else (home, `/shop`, `/admin`, `/account`, checkout) needs a
real Postgres connection, because the catalog, cart pricing, and inventory
are all database-backed now, not a static file.

### Database setup

Any Postgres works; Neon or Supabase are the easiest to get running in a
few minutes. If your provider pools connections (Neon and Supabase both
do, via pgbouncer), set `DATABASE_URL` to the pooled connection string and
`DIRECT_URL` to the direct one — `prisma migrate` needs the direct
connection, the app can use the pooled one. If your provider doesn't pool,
set both to the same value.

```bash
npx prisma migrate dev --name init   # creates every table
npm run db:seed                       # seeds a dev-only catalog (W852, M808, MW851D, M701N)
                                       # with color/size variants across 4 real inventory
                                       # locations (Koreatown, Buena Park, Warehouse, Online)
```

`npm run db:seed` is idempotent — safe to re-run. It is **development
data only**; do not run it against production once real inventory exists
(see Production Checklist).

### Stripe setup

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from `stripe listen` below
```

For local webhook delivery:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a `whsec_...` — put that in `.env.local`. The webhook
handles `checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded`, and
`checkout.session.async_payment_failed` — checkout is pinned to
card-only payment methods (see `app/api/checkout/route.ts`), so in
practice only the first two should ever fire.

### Admin setup

There's no seed-created staff account (don't want a default admin
password sitting in source control). Create one by hand once you have a
database connected:

```bash
npx prisma studio
```

Open the `User` table, create a row with `role = STAFF` (or higher) and a
`passwordHash` — generate one with:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
```

Then sign in at `/admin/login`. Every admin Server Action re-checks the
session role itself (see `lib/actions/*.ts`), on top of `middleware.ts`
and the `(dashboard)` layout — hiding a nav link is never what's actually
protecting these routes.

## Environment variables

See `.env.example` for the full list with explanations. Required to run
anything beyond the marketing pages: `DATABASE_URL`. Required for
checkout: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Required for
`/admin` and `/account`: `AUTH_SECRET`. Required for the reservation-expiry
cron: `CRON_SECRET`.

## Inventory reservation strategy

Stock is held the moment a customer starts checkout, not just at final
payment — this is the part of the original build that most needed
fixing, since without it two customers could both "buy" the last unit of
a low-stock variant. The full reasoning is documented in
`lib/inventory.ts`; short version:

1. `POST /api/checkout` reserves stock for every cart line atomically
   (`InventoryLevel.reserved`, guarded by a raw SQL conditional update so
   concurrent checkouts can't double-hold the same unit) before Stripe is
   ever called. If any line can't be reserved, checkout is refused with a
   real "out of stock" error.
2. The webhook (`checkout.session.completed`) converts the hold into a
   real sale — decrements on-hand `quantity`, releases the hold, creates
   the `Order`/`OrderItem` rows, all in one transaction.
3. `checkout.session.expired` (or the `/api/cron/release-reservations`
   backstop, wired to run once daily via `vercel.json` — Vercel's Hobby
   plan caps cron frequency at once/day; this is a backstop, not the
   primary release path) releases holds whose checkout was abandoned.
4. Every quantity/reserved change writes a matching `InventoryTransaction`
   audit row — nothing moves without a paper trail.

## Order numbering & webhook idempotency

- `Order.orderNumber` (`JGP-10001`, `JGP-10002`, ...) is derived from
  `Order.orderSeq`, a real Postgres identity column — two concurrent
  checkouts can never collide on the same number.
- Every Stripe event is logged to `StripeEvent` (keyed on Stripe's event
  id) before it's acted on, and `Order.stripeSessionId` is separately
  unique — two layers, so a redelivered webhook is always a safe no-op
  rather than a duplicate order.

## What's implemented

- Full marketing site (unchanged from the original build, minus the
  medical-claims language flagged in an earlier pass).
- **Database-backed catalog** — `/shop`, `/shop/[slug]`, and the homepage
  featured section all query Postgres directly; no static product file
  anymore.
- **Real color/size variants** — Korean mm sizing, one SKU per
  color+size, `ProductActions` only lets you add a variant that's
  actually in stock.
- **Multi-location inventory** with reservations, transfers, manual
  adjustments, and a full audit trail (`InventoryTransaction`).
- **Stripe Checkout** with server-computed pricing (never trusts the
  client cart) and the reservation flow above.
- **Order model** with tax/shipping/discount breakdown, payment status
  and fulfillment status as independent fields, tracking/carrier, and
  order-item snapshots (product name/SKU/color/size/price are captured at
  order time so historical orders stay accurate even if the catalog
  changes later).
- **Refunds** — full or partial, through Stripe, from the admin order
  page, capped against the remaining unrefunded balance.
- **Shipping (V1 flat-rate)** — server-computed from the reservation
  subtotal, never client-submitted; see `docs/SHIPPING.md`.
- **Tax** — Stripe Tax integration exists and is off by default
  (`STRIPE_AUTOMATIC_TAX_ENABLED=false`) until the required Stripe
  Dashboard configuration is actually done; see `docs/TAX_SETUP.md` before
  turning it on.
- **Auth** — Credentials + JWT for both `/account` (customers: register,
  sign in, order history) and `/admin` (staff, role-gated).
- **Admin**: Dashboard (real aggregates — today's revenue, orders,
  units sold, AOV, low stock, top products, sales by location), Orders
  (search/filter, fulfillment status + tracking, refunds, cancel),
  Inventory (per-location table, adjust, transfer, per-SKU transaction
  history), Products (create with a color×size variant matrix, edit,
  activate/archive, add variants).
- **Customer accounts** — register/sign in, order history, foot profile
  display if one exists (staff-entered, not self-service yet). Registering
  with an email that already has guest-checkout order history creates the
  account immediately but only *links* that history after a verification
  link is clicked (proving inbox ownership) — otherwise anyone could type
  in someone else's email at signup and see their orders. The link is
  console-logged in development (no email provider is wired in yet — see
  below) and is real/working end-to-end (`/api/auth/verify-email`), just
  not delivered anywhere in production until email is wired in.
- **Rate limiting** on registration (5/hour/IP) and checkout creation
  (20/10min/IP) — see `lib/rate-limit.ts` for why this is explicitly an
  in-memory placeholder (works for local dev, degrades on Vercel's
  per-request serverless model) and what to swap in for production
  (Upstash Redis).
- **Data model for returns/exchanges and purchasing/receiving**
  (`Return`, `ReturnItem`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`,
  `ReceivingRecord`) — admin has read-only list pages for these; the
  creation workflows aren't built yet (see Next).

## Not built yet (be honest about this before calling anything "done")

- **Return/exchange creation workflow** — the schema and admin list
  pages exist; there's no "start a return" action yet.
- **Purchase order creation / receiving workflow** — same: schema and
  list page exist, no create/receive UI.
- **Transactional email** — order confirmation, refund confirmation,
  password reset. No provider is wired in (`RESEND_API_KEY` etc. are
  commented out in `.env.example`). The webhook has a `TODO` marking
  exactly where to add order confirmation; the guest-history verification
  link (above) is the one email-shaped flow that already works logically,
  it just needs a real send instead of a console log.
- **Password reset flow** — the `VerificationToken` table and the token
  issue/consume pattern both exist (see verify-email), but there's no
  "forgot password" entry point yet, and it's blocked on the same missing
  email provider either way.
- **Object storage for product photography** — images are a `url`
  string field pointing at `/public/products/*.jpg` placeholders; there's
  no upload UI or real storage integration yet.
- **Real shipping carrier integration** — `lib/shipping.ts` is a flat-rate
  V1 (see `docs/SHIPPING.md`), not live carrier rates/labels. No
  Shippo/EasyPost integration; `Order.trackingNumber`/`carrier` and the
  `Shipment` model exist for staff to fill in by hand today.
- **Production-grade rate limiting** — see the in-memory caveat above.
- **Guest cart → account merge** — a persisted `Cart`/`CartItem` model
  exists for a logged-in customer's cart, but nothing currently syncs the
  client-side (localStorage) cart into it on login.
- **SEO** — no sitemap, no OG images beyond page titles, no product
  structured data, no redirect map yet.
- **Automated tests** — none. See Production Checklist.

## Shopify migration plan

Do this in order; don't delete/cancel anything Shopify-side until the
step that depends on it is verified working.

1. **Export from Shopify** — Products/variants (Admin → Products →
   Export, or the Admin API for a cleaner pull with images), Customers,
   Orders.
2. **Catalog migration** — write a one-off script (same shape as
   `prisma/seed.ts`, but reading the real export instead of hardcoded
   data) that inserts into `Product`/`ProductVariant`/`ProductImage` with
   real SKUs, sizes, and starting inventory per location. Do this on a
   staging database first.
3. **Customer + order history migration** — import for support lookup
   and so returning customers' history isn't lost; keep
   `Order.legacyShopifyOrderId` populated so old order numbers still
   resolve to something.
4. **Inventory migration** — reconcile real on-hand counts per location
   at cutover time (Shopify counts will be stale the moment you export
   them — do this as close to cutover as possible).
5. **Domain cutover** — point `jgpfootwear.store` DNS at Vercel; set up
   `jgpusa.store` as a 301 redirect to `jgpfootwear.store` (see Domain
   Structure below). Build the old-URL → new-URL redirect map before
   this step, not after.
6. **Stripe production activation** — go live with real Stripe keys only
   after a full test purchase (see Production Checklist) succeeds against
   production Postgres.
7. **Shopify shutdown** — only after at least one full billing cycle has
   passed with the new system as the source of truth and no discrepancies
   found.

Not everything needs to migrate: draft/abandoned Shopify orders and
marketing-only customer records (no order history) are reasonable to
leave behind rather than import.

## Domain structure

Canonical domain is `jgpfootwear.store`. `jgpusa.store` should 301-redirect
to it — configure this at the DNS/hosting level (a second Vercel project
with just a redirect, or a platform-level redirect rule), not hardcoded in
application code. `NEXT_PUBLIC_APP_URL` in `.env` is what the app uses for
absolute URLs (Stripe success/cancel URLs) — set it to the canonical
domain in production so a request arriving via the redirect still builds
correct URLs.

## Deploying to Vercel

See `docs/PRODUCTION_DEPLOYMENT.md` for the full step-by-step (environment
separation for preview vs. production databases, first-deploy checklist,
rollback procedure). Summary:

1. Push to GitHub, import into Vercel.
2. Set environment variables (see `.env.example`) in the Vercel project
   settings — `DATABASE_URL`, `DIRECT_URL`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `AUTH_SECRET`, `CRON_SECRET`,
   `NEXT_PUBLIC_APP_URL`.
3. Run `npx prisma migrate deploy` against production (not `migrate dev`)
   before or during first deploy — Vercel's build step doesn't run
   migrations automatically; wire it into your deploy process (a build
   command override, or a manual step) rather than skipping it.
4. `vercel.json` already declares the `/api/cron/release-reservations`
   cron (once daily — a Hobby-plan limitation; it's a backstop, not the
   primary release path) — Vercel picks this up automatically on deploy.
5. Add the deployed webhook URL
   (`https://jgpfootwear.store/api/webhooks/stripe`) in the Stripe
   dashboard once live, and copy that endpoint's signing secret into
   `STRIPE_WEBHOOK_SECRET`.
6. Do not run `npm run db:seed` against production — it's dev-only demo
   data.

## Security notes

- Stripe handles all card data (Checkout is PCI SAQ-A) — this app never
  touches raw card numbers.
- The webhook verifies Stripe's signature before writing anything, and is
  double-idempotent (`StripeEvent` log + unique `stripeSessionId`).
- Prices are always computed server-side from `ProductVariant`, never
  trusted from the client cart.
- `/admin` is protected in three independent layers: `middleware.ts`
  (Edge, JWT-only check), the `(dashboard)` layout (Node runtime, real
  session check), and every Server Action re-checking role itself.
- Passwords are hashed with bcrypt (cost 12), never stored or logged in
  plain text.
- Environment secrets live only in Vercel's environment variables —
  never commit `.env.local`.

## Production checklist

Don't call this production-ready until these are actually true, not just
plausible:

- [x] Prisma schema models the full domain (catalog, multi-location
      inventory + reservations, orders, customers, returns, purchasing, auth)
- [x] `npx prisma validate` / `generate` pass
- [x] `npx tsc --noEmit` passes clean
- [x] `next build` passes clean
- [x] Products/inventory are fully database-backed (no static catalog file)
- [x] Product variants (color × size) work end-to-end
- [x] Cart/checkout validates pricing and stock server-side
- [x] Webhook signature verification implemented
- [x] Webhook idempotency implemented (two layers)
- [x] Concurrency-safe inventory (reservation holds, guarded atomic updates)
- [x] Admin routes require server-side authorization (three layers)
- [x] Orders can be searched, viewed, fulfilled, tracked, refunded, cancelled
- [x] Refund architecture exists and is wired to Stripe
- [x] Environment variables documented (`.env.example`)
- [ ] **Actually run against a live Postgres database** — everything
      above is verified by `tsc`/`prisma validate`/`next build` in an
      environment with no real database available; a live DB is required
      to prove the runtime behavior, not just the types
- [ ] Stripe test checkout verified end-to-end against a live DB (session
      → webhook → Order → inventory decrement, in that order)
- [ ] Duplicate webhook delivery verified to not create a duplicate order
      (should follow from the idempotency design, but hasn't been run)
- [ ] A staff account actually created and admin login tested live
- [ ] Mobile checkout flow tested on a real device
- [ ] Transactional email wired in (order confirmation at minimum)
- [ ] Return/exchange and purchase-order creation workflows built
- [ ] Legal/compliance review of all marketing claims completed
- [ ] Vercel deployment actually run, not just locally validated
- [ ] Domain cutover + redirect map executed

## CHANGED / WHY / TESTED / NEXT

**CHANGED**: Rebuilt the data model from a 7-table demo schema into the
full production domain (auth, multi-location inventory with reservations,
orders with tax/shipping/refunds, returns, purchasing). Made the
storefront database-backed with real color/size variants. Rewrote
checkout and the Stripe webhook around atomic inventory holds, Postgres-
sequence order numbers, and two-layer webhook idempotency. Added
Credentials+JWT auth with role-gated `/admin` (three enforcement layers)
and a customer `/account` area. Built a real (non-mock) admin: dashboard
aggregates, order management + refunds, inventory management + transfers
+ audit history, product creation/editing. A parallel refinement pass on
top of that landed real flat-rate shipping + a safe-by-default Stripe Tax
toggle (`lib/shipping.ts`, `lib/tax.ts`, `docs/SHIPPING.md`,
`docs/TAX_SETUP.md`), an ADR documenting the custom-vs-Medusa decision
(`docs/ARCHITECTURE_DECISION.md`), request rate limiting on
registration/checkout, and a real security fix to the registration flow
(guest order history is now only linked to a new account after an email
ownership verification step, not merely by typing in a matching email).

**A note on how this file was written**: this build happened as several
passes converging on the same schema/routes at once, refining each
other's work in place rather than one linear pass — the ADR, the
reservation-vs-simple-decrement upgrade, the tax/shipping modules, the
registration security fix, and the rate limiting were each improvements
layered on top of an earlier version of the same files, not independent
alternatives. Where two implementations of the same admin page collided
outright (`app/admin/orders`, `app/admin/inventory`, `app/admin/layout.tsx`
existing both inside and outside the `(dashboard)` route group), the
non-route-grouped versions were removed — they would have force-redirected
`/admin/login` into an infinite loop, since that layout had no exemption
for the login page itself.

**WHY**: The original build was a working checkout skeleton (Stripe
session → webhook → Order) sitting on a static product file with a
single un-guarded inventory integer and no auth, no admin, and no data
model for returns/purchasing/customers. None of that scales into "replace
Shopify" — this pass builds the actual domain model and the commerce-
critical paths (pricing, inventory, idempotency) that would otherwise be
the hardest things to safely retrofit later.

**TESTED**: `npx prisma validate`, `npx prisma generate`, `npx tsc
--noEmit`, and `npx next build` all pass clean. `prisma/seed.ts` runs
correctly up to (and only fails at) the expected "no DATABASE_URL"
error, confirming its logic/imports are sound. The storefront, checkout
error paths, and admin login were browser-verified against the running
dev server. **Not tested**: anything requiring a live Postgres connection
— no database was available in this environment (no credentials, and no
local Postgres/Docker available either) — so the actual runtime behavior
of checkout → webhook → order → inventory decrement has not been run
end-to-end. That's the top item in the Production Checklist above.

**NEXT**: Get a real Postgres instance connected and run the full
checkout flow end-to-end with Stripe test keys (this is the one thing
that most needs doing before anything else here can be trusted). Then, in
rough priority order: create a real staff account and verify `/admin`
login live; wire up transactional email (order confirmation first); build
the return/exchange creation workflow; build purchase order
creation/receiving; get the legal/compliance review of marketing claims
done; then SEO, object storage for real photography, and the Shopify
migration itself.
