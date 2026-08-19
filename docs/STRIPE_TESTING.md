# Stripe Test-Mode Runtime Testing

## Status: BLOCKED — TEST CREDENTIAL REQUIRED

No Stripe credentials exist in the environment this was built in. The
following are required and currently unset:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   (not currently read by any code path —
                                       Checkout is the hosted-redirect flow,
                                       which only needs the secret key
                                       server-side; keep this documented in
                                       case a future Payment Element / Elements
                                       integration needs it client-side)
```

This document is **not** a substitute for running these tests — it's the
exact procedure for whoever has real Stripe test-mode credentials to
follow. Do not treat "the procedure is documented" as equivalent to "the
system was verified." It wasn't, yet.

## What's already verified without live credentials

`tests/integration/webhook-idempotency.test.ts` exercises the *real*
webhook route handler (`app/api/webhooks/stripe/route.ts`) end-to-end,
including real HMAC signature generation/verification via the Stripe SDK's
local `generateTestHeaderString` / `constructEvent` — this requires no
network call to Stripe (signing and verifying a webhook signature is a
pure local HMAC operation). It proves:

- An invalid signature is rejected (400).
- A duplicate event id is processed exactly once (order/payment/inventory
  movement all `+0` on replay).
- An unpaid `checkout.session.completed` (delayed payment method scenario)
  never creates a paid order or moves inventory.

It does **not** and cannot prove that a real Stripe Checkout Session
actually redirects a browser through Stripe's hosted payment page and
fires the webhook Stripe would really send — that step needs live test
credentials.

## Procedure once test credentials exist

1. Get test-mode keys from https://dashboard.stripe.com/test/apikeys.
2. `.env.local`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. Install the Stripe CLI (https://stripe.com/docs/stripe-cli), then:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the `whsec_...` it prints into `.env.local` as
   `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.

### Successful purchase

```bash
npm run dev
# in the browser: add an in-stock item to cart, checkout, pay with 4242 4242 4242 4242
```

Verify, in order:

```text
Cart → server validates variant/price/stock → inventory reserved
  → Stripe Checkout Session created → test card payment succeeds
  → stripe listen forwards checkout.session.completed
  → exactly one Order row (paymentStatus=PAID)
  → exactly one Payment row
  → the Reservation is COMMITTED, linked to the new order
  → InventoryLevel.quantity decreased by exactly the ordered quantity
```

Then, from the Stripe CLI, **replay the same event**:

```bash
stripe events resend evt_...   # the event id stripe listen printed
```

Expected: order count, payment count, and inventory quantity all unchanged
— `tests/integration/webhook-idempotency.test.ts` already proves this at
the code level; this step proves it against Stripe's actual redelivery
behavior, not just a locally-constructed replay.

### Expired checkout

```bash
stripe trigger checkout.session.expired
```

Or: start a real checkout, don't pay, and either wait for the 30-minute
`expires_at` or use the CLI trigger above against a session you started.
Expected: the Reservation for that checkout attempt moves from `ACTIVE` to
`RELEASED`, and `InventoryLevel.reserved` drops back down — available
stock is restored.

### Failed / declined payment

Use Stripe's documented decline test card (`4000 0000 0000 0002`).
Expected: no `Order` row is created, no `SALE` `InventoryTransaction` is
written, `fulfillmentStatus`/`paymentStatus` are never set as if paid.

## Production activation

Only after every test above has actually passed against test-mode Stripe:

1. Complete Stripe's account activation (business details, bank account).
2. Switch `.env` (production, in Vercel) to live-mode keys.
3. Create a **live-mode** webhook endpoint in the Stripe Dashboard pointed
   at `https://<production-domain>/api/webhooks/stripe`, and set that
   endpoint's live-mode signing secret as production's
   `STRIPE_WEBHOOK_SECRET` — live and test mode have entirely separate
   webhook secrets; the test-mode one from `stripe listen` does not carry
   over.
4. Run one real, low-value order (or a fully refundable purchase) as a
   live-mode smoke test before considering checkout production-verified.
