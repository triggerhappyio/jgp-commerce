# Launch Runbook

This is the ordered checklist for the actual production cutover — after
every gate in `docs/PRODUCTION_CHECKLIST.md` is PASS, not before.
`docs/SHOPIFY_MIGRATION.md` covers the data-import side in detail; this
doc is the surrounding sequence and timing.

**Do not cancel or shut down Shopify at any point in this runbook.** It
stays live and reachable through T+24 HOURS at minimum.

## T-24 HOURS

- [ ] Confirm every `docs/PRODUCTION_CHECKLIST.md` gate is PASS, not
      "looks correct" — re-run the actual commands, don't rely on memory.
- [ ] Confirm production secrets are set in Vercel (Production
      environment, not Preview) — see `lib/env.ts` `ENV_CONTRACT` for the
      full list.
- [ ] Confirm production PostgreSQL exists and is reachable, with backup/
      point-in-time-recovery enabled (verify in the provider dashboard,
      don't assume the default).
- [ ] Take a manual backup/snapshot of production Postgres even with PITR
      on (see `docs/DATABASE_MIGRATIONS.md` "Backup expectations").
- [ ] Freeze non-critical Shopify catalog/inventory edits — the closer to
      cutover, the smaller the final reconciliation gap.
- [ ] Run the Shopify product/customer/order import scripts
      (`scripts/shopify-import/`) against production — everything except
      the final inventory reconciliation, which happens at T-2.

## T-2 HOURS

- [ ] `npx prisma migrate deploy` against production Postgres (never
      `db push`, never `migrate reset` — see `docs/DATABASE_MIGRATIONS.md`
      "Prohibited in any deploy flow").
- [ ] `npx prisma migrate status` — confirm no pending/failed migrations.
- [ ] Final Shopify inventory export, then
      `npx tsx scripts/shopify-import/reconcile-inventory.ts` against
      production.
- [ ] Deploy the production Vercel build. Do **not** attach the
      `jgpfootwear.store` domain yet — verify first on the temporary
      `*.vercel.app` production URL.
- [ ] On the temporary URL: complete one real Stripe **live-mode**
      low-value (or fully refundable) test purchase end-to-end. Verify the
      order, payment, inventory decrement, and confirmation email all
      landed correctly.
- [ ] Configure the Stripe **live-mode** webhook endpoint pointed at the
      temporary URL's `/api/webhooks/stripe`, confirm signature
      verification succeeds, then update it to the real domain once DNS is
      live (see CUTOVER below).
- [ ] Verify the production rate limiter (Upstash), email (Resend), and
      storage (Vercel Blob) are all actually configured — not silently
      falling back (see `lib/rate-limit.ts` / `lib/email.ts` /
      `lib/storage.ts` — each fails loudly in production if misconfigured,
      so a request that succeeds here is real evidence, not an assumption).

## CUTOVER

- [ ] Point `jgpfootwear.store` DNS at Vercel.
- [ ] Verify TLS certificate issued and valid.
- [ ] Verify `www.jgpfootwear.store`, `jgpusa.store`,
      `www.jgpusa.store` all redirect to the canonical
      `https://jgpfootwear.store` (see `docs/SHOPIFY_MIGRATION.md` "5. Domain").
- [ ] Update the Stripe live-mode webhook endpoint URL to the real domain;
      confirm one webhook delivery succeeds against it (Stripe Dashboard →
      Developers → Webhooks → the endpoint → recent deliveries).
- [ ] Smoke test on the real domain: homepage, `/shop`, a product page,
      add to cart, checkout initiation.

## T+15 MIN

- [ ] Watch Vercel function logs for error-rate spikes (5xx responses).
- [ ] Watch Stripe Dashboard for webhook delivery failures.
- [ ] Confirm the reservation-expiry cron (`/api/cron/release-reservations`)
      fired at least once and returned 200.

## T+1 HOUR

- [ ] Place one more real, low-value live purchase — confirm order,
      inventory, and email again, now against the real domain with real
      DNS/TLS in the path (not just the temporary Vercel URL from T-2).
- [ ] Check `StripeEvent` table for any rows with `error` set and
      `processedAt` null (see `docs/INCIDENT_RECOVERY.md` "Webhook failures").
- [ ] Check `InventoryLevel` for any negative `quantity` (should be
      structurally impossible — see the CHECK constraint in
      `docs/DATABASE_MIGRATIONS.md` — but verify, don't assume).

## T+24 HOURS

- [ ] Review a full day of logs for any recurring, unexplained error —
      not just spikes, patterns (see Phase 32 "Final Staging Soak" —
      the same standard applies to real production logs now).
- [ ] Confirm at least one real customer order (not staff-initiated test
      purchases) completed successfully, if traffic allows.
- [ ] Only now begin planning Shopify shutdown — not shutting it down yet,
      just starting the conversation. Keep it live and reachable for a
      real observation window (days, not hours) before any shutdown steps.

## ROLLBACK CONDITIONS

Any of the following → **stop traffic / roll back** immediately, per the
next section. Financial correctness takes precedence over uptime — an
outage is recoverable; a duplicated charge or lost order is a customer
harm event.

```text
- Checkout consistently fails (not an isolated blip)
- A payment succeeds in Stripe but no corresponding Order is created
- Inventory goes negative, or a SALE InventoryTransaction fires twice for
  one payment
- Any evidence of a duplicate charge
- /admin becomes inaccessible to legitimate staff
- Sustained database connectivity instability
- Any confirmed authentication/authorization bypass
- An unexplained, sustained spike in 5xx responses
```

### Rollback procedure

1. **DNS-level rollback (fastest, always available):** point
   `jgpfootwear.store` back at wherever Shopify was serving it before
   cutover. This is the immediate stop-the-bleeding action — Shopify was
   deliberately kept live through T+24 HOURS (and beyond) specifically so
   this is always possible.
2. **Do not point DNS back at the new app until the root cause is fixed
   and re-verified against staging**, not just patched and redeployed
   optimistically.
3. **Database:** if the rollback condition involves data corruption
   (negative inventory, duplicate orders), do not attempt a live fix under
   pressure — restore from the T-24/T-2 backup per
   `docs/DATABASE_MIGRATIONS.md` "Rollback / recovery procedure", then
   replay only the orders/inventory changes that are known-good.
4. **Stripe:** if a duplicate-charge condition is suspected, do not issue
   ad hoc refunds before understanding the actual scope — query
   `StripeEvent` and `Order`/`Payment` for the affected window first (see
   `docs/INCIDENT_RECOVERY.md`), then refund precisely, once.
5. Document what happened, when, and the fix — before attempting cutover
   again.
