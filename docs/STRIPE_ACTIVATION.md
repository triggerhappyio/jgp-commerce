# Stripe Activation

See also `docs/STRIPE_TESTING.md` for the full runtime test procedure once
this setup is done — this doc is just getting the keys in place.

1. Go to **dashboard.stripe.com** — sign up or sign in.
2. Toggle to **Test mode** (top-right switch) — stay here for everything
   below until the very last step.
3. Developers → API keys → copy the **Secret key** (`sk_test_...`).
4. Install the **Stripe CLI** (stripe.com/docs/stripe-cli) if not already
   installed.
5. Set, for local dev and Preview (both test mode):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```
6. Run `stripe login`, then for local dev:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   It prints a `whsec_...` — that's your local `STRIPE_WEBHOOK_SECRET`.
   For Preview, instead create a webhook endpoint in the Dashboard
   (Developers → Webhooks → Add endpoint) pointed at
   `https://<preview-url>/api/webhooks/stripe`, select the events
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed` — copy that endpoint's signing
   secret as `STRIPE_WEBHOOK_SECRET` for the Preview environment.
7. Set both in the right place:
   - Local: `.env.local`
   - Vercel Preview: Settings → Environment Variables → scope to Preview
8. Run a test transaction — full procedure in `docs/STRIPE_TESTING.md`.
9. **Only after** every test in `docs/STRIPE_TESTING.md` passes: switch
   Stripe to **Live mode**, repeat steps 3 and 6 for live keys, and set
   those as the **Production**-scoped env vars in Vercel — never reuse the
   test-mode values there.

## Never do this

- Never paste a secret key into this doc, a commit, or the chat — only
  into `.env.local` or Vercel's environment variable UI.
- Never put a live key in the Preview scope (see `lib/env.ts`
  `assertSafeEnvironmentCombination()` — it will refuse to start checkout
  if it detects this).

## Test it worked

```bash
npm run env:check
```
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` should both show `OK`.
