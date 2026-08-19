# Tax Setup — Stripe Tax

JGP uses **Stripe Tax**, calculated automatically inside Stripe Checkout.
The application never computes tax itself — it only ever asks Stripe to,
and only when explicitly told to via configuration (see below). This
document covers the Dashboard steps this depends on, which nobody but JGP
can complete — no amount of code changes substitutes for them.

## How it works in this codebase

- `lib/tax.ts` is the single place tax configuration is read from. Nothing
  else in the app knows how Stripe Tax gets turned on.
- `automaticTaxParam()` returns `{ enabled: <STRIPE_AUTOMATIC_TAX_ENABLED === "true"> }`,
  spread directly into `stripe.checkout.sessions.create(...)` in
  `app/api/checkout/route.ts`.
- **Default is OFF.** Setting `STRIPE_AUTOMATIC_TAX_ENABLED=true` without
  first completing the Dashboard steps below does not "fake" tax — Stripe
  will either compute $0 tax everywhere or reject the session, depending on
  what's missing. The env var is a statement that the Dashboard side is
  actually done, not a feature flag that makes tax happen on its own.
- Once enabled, the finalized tax amount Stripe actually charged is read
  back from the completed Checkout Session (`session.total_details.amount_tax`)
  in the webhook and stored on `Order.taxCents` — this is the reconciliation
  field. The application never calculates or predicts tax; it only records
  what Stripe already charged.

## Required Stripe Dashboard configuration (human action)

1. **Activate Stripe Tax** — Dashboard → Tax → "Get started." This is a
   business decision with real legal/financial implications; do this from
   JGP's own Stripe account, not something to be automated.
2. **Add tax registrations** for every state/country JGP is actually
   required to collect tax in. This app does not, and should not, make that
   determination — it's a business/legal call for JGP (with an accountant
   or tax advisor, not this codebase) to make. Stripe Tax only calculates
   tax for jurisdictions you've registered.
3. **Product tax code / tax behavior** — Stripe Tax needs to know footwear's
   tax category. Dashboard → Tax → Settings → Product tax code, or set it
   per-Price if JGP's catalog needs different treatment for different
   product types later. Footwear generally maps to Stripe's general
   "clothing" tax code, but confirm the exact code in the Dashboard's tax
   code list — do not guess this in application code.
4. Confirm **shipping address collection** is required before tax is
   calculated — already true in this app (`shipping_address_collection`
   is always set on the Checkout Session), since Stripe Tax needs a
   destination address to compute tax.

## Test-mode procedure

1. Set `STRIPE_AUTOMATIC_TAX_ENABLED=true` in `.env.local` (Stripe test
   mode; Tax must be separately activated for the test-mode Dashboard too —
   test and live mode have independent Tax settings).
2. Run a test checkout, enter a shipping address in a state you've
   registered for tax in test mode.
3. Confirm the Checkout page itself shows a nonzero tax line.
4. Complete the test payment, then check the resulting `Order.taxCents` in
   the database (or `npx prisma studio`) — it should match what Checkout
   displayed.

## Production activation procedure

1. Complete Dashboard steps 1–3 above in **live mode** (test-mode
   activation does not carry over).
2. Set `STRIPE_AUTOMATIC_TAX_ENABLED=true` in the production Vercel
   environment variables.
3. Place one real low-value order (or use Stripe's live-mode test clock /
   a fully refundable test purchase) to confirm live tax calculation before
   relying on it for real orders.

## What's stored on the Order (reconciliation fields)

| Field | Source |
|---|---|
| `subtotalCents` | Sum of reserved line items, computed server-side from `ProductVariant.priceCents` |
| `taxCents` | `session.total_details.amount_tax` — whatever Stripe Tax actually charged |
| `shippingCents` | `session.total_details.amount_shipping` — see `docs/SHIPPING.md` |
| `discountCents` | Reserved for future discount-code support; `0` until implemented |
| `totalCents` | `session.amount_total` — the authoritative, Stripe-confirmed total |
| `currency` | `usd` (V1 is USD-only) |

None of these are calculated twice or reconciled against a second
calculation — the webhook trusts Stripe's own finalized numbers, because
Stripe is the system of record for what was actually charged.
