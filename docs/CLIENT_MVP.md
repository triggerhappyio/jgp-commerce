# Client MVP — What This Deployment Is

This document describes the current `staging` deployment as of 2026-09-05,
for anyone (client, internal reviewer) about to look at it. It is a
**demo/staging release**, not a production cutover. See
`docs/PRODUCTION_CHECKLIST.md` for what's still required before this can
process real customer payments.

## What this is safe to show a client

The full storefront, cart, customer account, and admin operator flows,
running against a real Postgres database (Neon) with real (not mocked)
inventory, orders, and returns logic. Nothing on the customer-facing site
displays placeholder, Lorem ipsum, or dev-only text. Online checkout is
intentionally disabled — see below — everything else is fully live.

**Live URL (staging branch, redeploys automatically on every push to
`staging`)**:
`https://jgp-commerce-git-staging-lebal-os-s-projects.vercel.app`

This URL sits behind Vercel's Deployment Protection (SSO). A client
without a Vercel account on this team gets an auth-gated page instead of
the site unless given one of:

1. **A bypass link** (set up for this demo — see below): visiting it once
   sets a cookie in their browser, after which they browse the site
   normally, no Vercel account needed. This is what to send the client.
2. **Vercel team membership** (Viewer role) — an alternative if they'd
   rather sign in with their own account instead of using a link.

The bypass link uses a "Protection Bypass for Automation" secret
(`vercel project protection enable jgp-commerce --protection-bypass`),
which is shareable by design — its only capability is viewing this
staging deployment — but still treat it like a credential: don't post it
anywhere public, and regenerate it (disable, then re-enable, which
issues a new value) if it's ever shared more widely than intended.
Retrieve the current value with:

```bash
vercel project protection jgp-commerce --json
```

— under `protectionBypass`, each key is a usable secret. Build the link
as:

```
https://jgp-commerce-git-staging-lebal-os-s-projects.vercel.app/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true
```

Verified 2026-09-05: visiting this link in a fresh browser renders the
real homepage (not an SSO gate), and the cookie persists across
navigation to `/shop`, `/shop/w852`, `/checkout`, `/account/login`, and
`/admin/login` without needing the query param again.

## Checkout is intentionally disabled right now

`STRIPE_SECRET_KEY` is not configured with a real value on staging.
Rather than a dead "Checkout with Stripe" button or a server error, the
cart page shows:

> Online checkout is being activated for launch. Your cart is saved. In
> the meantime, visit us in Los Angeles or Buena Park, or reach out via
> the Contact page to place an order.

This is a deliberate, correct state for a pre-launch demo — not a bug.
Activating real checkout is a separate, later step (see
`docs/STRIPE_ACTIVATION.md`): once a real Stripe key is added to the
Preview/Production environment, the same code path automatically shows
the live checkout button instead, with no code change required.

## Test accounts

Seeded by `npm run db:seed:staging` against the same database staging
reads from. Passwords are randomly generated per run and printed to the
console only — never committed. Re-run the script and use whatever it
prints if you need fresh credentials:

- `staging-admin@jgpusa.test` — ADMIN, full `/admin` access
- `staging-staff@jgpusa.test` — STAFF
- `staging-customer@jgpusa.test` — CUSTOMER, for `/account`

## What was fixed to get here (this pass)

- **Cart wiped on every hard navigation/reload** — a hydration-ordering
  bug in `components/CartContext.tsx` where the localStorage write
  effect ran once with a stale empty cart before the read effect's
  update had been applied, overwriting real cart data with `[]`. Fixed
  and reproduced-then-verified-fixed with a real browser test.
- **`/api/checkout` returned a raw, unhandled 500 with no body** on the
  live staging deployment — confirmed live before the fix, confirmed
  fixed live after redeploy. Root cause: rate-limit/storage/email
  "fail closed in production" guards checked raw `NODE_ENV`, which
  Vercel sets to `"production"` for Preview builds too, not just real
  Production. Switched to `appEnv()` (based on `VERCEL_ENV`) everywhere
  this pattern appeared.
- **Product page and shop grid overflowed / clipped content off-screen
  at 768px, and squeezed the entire purchase panel unusably narrow
  below ~720px** — fixed with a responsive breakpoint and a
  `min-width: 0` reset on grid items (a CSS Grid default that otherwise
  lets a track's content force the whole grid, and the page, wider than
  the viewport). Verified visually at 390 / 768 / 1440px.
- Seed data no longer describes the demo product as a "staging fixture"
  in customer-facing copy.
- `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` reclassified from
  required-in-development to genuinely optional, matching how the app
  actually behaves.

## Click-through verification (2026-09-05, against the live bypass-linked URL)

Full walkthrough run against the actual deployed staging URL (not just
local dev), using the bypass link above: homepage → shop → product page
→ add to cart → hard navigation to `/checkout` (cart correctly
persisted, disabled-checkout message rendered correctly) → customer
login/account → admin login/dashboard (real $0.00 / zero-order
aggregations, no fake data). No dead buttons, no raw errors, no
placeholder content encountered anywhere in this path.

**Not yet verified**: an actual completed transaction through Stripe.
`STRIPE_SECRET_KEY` isn't configured on staging, and obtaining a real
Stripe test key needs either an existing Stripe account or creating one
— account creation isn't something to do on someone else's behalf, so
this is deferred until a real test key is available. Once it is, follow
`docs/STRIPE_ACTIVATION.md` then `docs/STRIPE_TESTING.md` to run a full
test-card purchase and confirm it produces a real Order, decrements
inventory, and shows up on the admin dashboard.

## Known, accepted limitations of this demo

- **Admin sidebar does not collapse on phone-width screens** — it stays
  full nav width, squeezing the dashboard content into a narrower
  column than ideal. Nothing is broken or unreadable, just not
  optimized for a phone. Admin is a staff tool, not part of the
  customer path — reasonable to leave for a later pass rather than
  redesign the nav for this MVP.
- Only one product (W852) is seeded. Real catalog import is a separate,
  already-scoped step — see `docs/SHOPIFY_IMPORT_VALIDATION.md` /
  `docs/SHOPIFY_MIGRATION.md`.
- Email sending, image upload storage, and distributed rate limiting are
  all optional-and-degrade-gracefully outside real production, same as
  Stripe — none are configured on staging today. This is fine for a
  demo; each has its own activation doc in `docs/`.

## Do not treat this as production-ready

This pass verified the demo is safe to *show*, not safe to *sell
through*. Real payments, production-grade rate limiting, email
delivery, and a full catalog are all still outside this scope — see
`docs/PRODUCTION_CHECKLIST.md`.
