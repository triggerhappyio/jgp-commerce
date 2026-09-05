# JGP Commerce — Engineering Handoff

**As of 2026-09-05.** This file is the entry point for any engineer picking
this project up. Read this first — it tells you what's real, what's stale
in the other docs, and where to go next.

## What this is

A custom-built commerce platform for JGP Footwear (Korean-American premium
footwear brand) — own Postgres, own Stripe integration, own admin system.
Not headless Shopify, not a template. Built with Next.js (App Router),
Prisma/PostgreSQL, NextAuth, and Stripe.

## Current status: client-demoable, not production-launched

There is a live, working staging deployment with a real database, real
tested commerce logic, and a real admin panel. It has **never processed a
real payment** and has **one seed product**. It is safe to demo to a
client; it is not yet ready to sell through. See "Must-haves before real
launch" below for the exact gap list.

## Beyond the online storefront: le bal OS

"le bal" and "JGP" are the same business. `docs/LE_BAL_OS_INTEGRATION.md`
reconciles a separate architectural memo (an internal shop-operations
system — customer visits, foot assessments, footprint archive,
appointments, in-store Square/Clover checkout) with this codebase. Short
version: extend this Postgres/Prisma/Next.js stack with new operational
models rather than standing up Supabase as a second backend — this
schema already has more of what that memo needs than it first appears
(a real inventory ledger, RBAC, real store locations, and an
`Order.source` enum that already includes `RETAIL`). Read that doc before
starting any in-store-operations work.

## Which docs to trust

This repo accumulated docs across several work passes and some are stale.
In order of how current/reliable they are:

1. **This file** and **`docs/CLIENT_MVP.md`** — accurate as of 2026-09-05,
   reflect real testing against a live deployment.
2. **`docs/VALIDATION_RESULTS.md`** — accurate evidence log for the
   integration test suite, real Neon runs.
3. **`docs/ARCHITECTURE_DECISION.md`, `docs/DATABASE_MIGRATIONS.md`,
   `docs/RETURNS_EXCHANGES.md`, `docs/TAX_SETUP.md`, `docs/SHIPPING.md`,
   and the per-provider setup docs** (`STRIPE_ACTIVATION.md`,
   `UPSTASH_SETUP.md`, `RESEND_SETUP.md`, `BLOB_SETUP.md`,
   `NEON_SETUP.md`, `VERCEL_SETUP.md`) — accurate architecture/setup
   reference, written when each piece was built and not since invalidated.
4. **`README.md` and `docs/PRODUCTION_CHECKLIST.md`** — **stale**. Written
   early, before the Next.js 14→16 upgrade, before any real database
   existed, before the app was ever deployed. README still says "Next.js
   14" and "no object storage or email provider wired in" — both wrong
   (see below). PRODUCTION_CHECKLIST.md says migrations/tests/mobile were
   never run — they have been, against real infrastructure. Don't delete
   these; they have genuinely useful architectural detail, but verify
   anything status-related against this file instead of trusting them.

## Getting it running

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL/DIRECT_URL at minimum
npx prisma migrate deploy      # applies existing migrations (don't use `migrate dev` against shared data)
npm run db:seed:staging        # seeds one product (W852) + one admin/staff/customer test account each
npm run dev
```

Any Postgres works; this project was run against Neon (serverless,
branch-based). `npm run env:check` tells you what's configured vs.
missing for whichever environment you're in — Stripe/email/storage/rate-
limiting are all designed to be *optional* outside real production (the
app degrades gracefully, it doesn't crash), so don't expect every var to
be required just to get `npm run dev` working.

Full health-check sequence (what CI should run):

```bash
npm run env:check && npm run db:check && npm run test:unit && npm run test:commerce && npm run lint && npm run build
```

## What's actually built (verified, not aspirational)

**Commerce engine**
- Full data model: products/variants/SKUs, per-location inventory,
  orders, payments, customers, returns, role-based auth
  (CUSTOMER/STAFF/MANAGER/ADMIN/SUPER_ADMIN) — see `prisma/schema.prisma`
- Reservation-based inventory: atomic guarded SQL decrement so two
  concurrent checkouts can never oversell the same unit; a
  quantity/reserved CHECK constraint backs this at the database level too
- Independent Order / Payment / Fulfillment / Return status state
  machines (deliberately not merged into one enum — see
  `docs/ARCHITECTURE_DECISION.md`)
- Idempotent Stripe webhook handling (`StripeEvent` table, unique on
  Stripe's event id) — a duplicate webhook delivery cannot double-create
  an order or double-decrement inventory
- Refunds are row-locked (`SELECT ... FOR UPDATE`) — a real concurrent-
  refund double-charge-back race was found and fixed during this build
- Returns/exchange workflow is fully wired end-to-end: create (on the
  order detail admin page) → receive → inspect per item → reject or
  complete (on the return detail admin page) — see
  `lib/actions/returns.ts` and `app/admin/(dashboard)/returns/`

**Storefront & accounts**
- Homepage, shop listing, product detail (live variant/size/stock state,
  responsive down to 390px), cart (persists correctly across page
  reloads — a real hydration-ordering bug here was found and fixed),
  checkout (shows a polished "coming soon" state instead of a dead button
  or a crash when Stripe isn't configured — see `components/CheckoutClient.tsx`)
- Customer register/login/logout/account with order history; a
  guest-order-claim flow that requires a single-use emailed verification
  token before attaching order history to an account (prevents one
  customer stealing another's order history by guessing an email)

**Admin** (`/admin`, role-gated, defense-in-depth: edge middleware +
independent Node-runtime re-check in the layout + independent re-check in
every Server Action)
- Dashboard with real Postgres aggregations (revenue, orders, units,
  AOV, low stock, top products) — shows honest zeros, never fake data
- Orders (detail, fulfillment status, refunds), Products, Inventory
  (adjust + transfer between locations, audited), Customers, Returns,
  Purchasing

**Infrastructure**
- Next.js 16.3.1, TypeScript, Prisma 5.x, NextAuth v5 (JWT sessions)
- Deployed to Vercel (`jgp-commerce` project), `staging` branch
  auto-deploys; GitHub repo at `triggerhappyio/jgp-commerce`
- Neon Postgres, migrations applied to a real database (not just
  generated SQL)
- 14/14 tests passing against real Neon: 8 unit (`tests/unit/`), 6
  integration (`tests/integration/` — inventory concurrency, webhook
  idempotency, refund concurrency)
- Environment-mode safety: `appEnv()` in `lib/env.ts` uses `VERCEL_ENV`
  (production/preview/development), not raw `NODE_ENV` — Vercel sets
  `NODE_ENV=production` for Preview deployments too, and an earlier
  version of this code used the wrong one, which caused a real,
  since-fixed unhandled 500 on the live checkout endpoint

## Must-haves before real launch

In rough priority order:

1. **Run one real Stripe transaction, start to finish.** The code path
   is built and covered by integration tests using simulated webhook
   payloads, but no one has ever run an actual card through it. Get a
   Stripe test-mode key (`docs/STRIPE_ACTIVATION.md`), wire it into the
   Preview environment, and complete a real purchase, watching it produce
   exactly one Order and one correct inventory decrement.
2. **Activate Stripe for real** (live-mode key, Tax registration
   decisions, live webhook endpoint) — see `docs/STRIPE_ACTIVATION.md`
   and `docs/TAX_SETUP.md`. Tax jurisdiction registration is explicitly
   left as a business/legal decision, not something to infer from code.
3. **Wire in a real email provider (Resend) and file storage (Vercel
   Blob).** Both are fully coded for (`lib/email.ts`, `lib/storage.ts`)
   but have no real credentials anywhere yet — order confirmation emails
   currently just log, and there's no way to upload a real product image.
   See `docs/RESEND_SETUP.md` / `docs/BLOB_SETUP.md`.
4. **Import the real product catalog.** Only one demo product (W852) is
   seeded. Tooling for a Shopify import already exists — see
   `docs/SHOPIFY_IMPORT_VALIDATION.md` and `docs/SHOPIFY_MIGRATION.md`.
5. **Fix the one remaining npm audit finding** (a transitive `qs`
   package, moderate severity) — `npm audit fix` should clear it; just
   hasn't been run.
6. **Admin sidebar doesn't collapse on phone widths.** Not broken, just
   not optimized — low priority since admin is a staff tool.
7. **Decide production Deployment Protection policy.** Staging uses a
   bypass link for demo access; decide who (if anyone) needs gated access
   to the real production domain, since the public storefront itself
   will be fully open there, unlike staging.
8. **Set up Upstash Redis for rate limiting in real production** — the
   app fails closed and refuses to serve checkout/login/register in real
   production without it configured (by design — an in-memory rate
   limiter doesn't work correctly across serverless instances). See
   `docs/UPSTASH_SETUP.md`.

## Where things live

- `prisma/schema.prisma` — the entire data model, read this first for
  architecture
- `lib/` — business logic: `env.ts` (environment-mode safety),
  `inventory.ts` (reservation lifecycle), `auth.ts`, `email.ts`,
  `storage.ts`, `rate-limit.ts`, `tax.ts`, `shipping.ts`,
  `actions/*.ts` (Server Actions, one file per domain)
- `app/api/checkout/route.ts` and `app/api/webhooks/stripe/route.ts` —
  the two most correctness-critical files in the app
- `app/admin/(dashboard)/` — all admin UI (note: there is also an
  `app/admin/` tree outside the route group for `/admin/login` only —
  don't be confused by two `admin` directories, they're not duplicates)
- `tests/unit/` and `tests/integration/` — the latter needs a real
  `DATABASE_URL` to run; it skips honestly (doesn't fake a pass) if none
  is configured — see `tests/integration/helpers.ts`
- `docs/` — everything else, see "Which docs to trust" above for how
  much to rely on each one
