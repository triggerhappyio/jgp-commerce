# Incident Recovery

Quick-reference for "something's wrong in production" — paired with
`docs/DATABASE_MIGRATIONS.md` (migration-specific rollback) and
`docs/STRIPE_TESTING.md` (Stripe-specific verification).

## Webhook failures

**Symptom**: a customer paid but no order appeared, or `StripeEvent` rows
are accumulating with `error` set and `processedAt` null.

1. Check the Vercel function logs for `app/api/webhooks/stripe` around the
   event's timestamp — the handler logs `[webhook] failed to process ...`
   with the underlying error before returning 500.
2. A 500 response means Stripe will automatically retry the same event —
   check the Stripe Dashboard → Developers → Webhooks → the endpoint →
   that event's delivery attempts. If the underlying bug is fixed, the
   next automatic retry (or a manual "resend" from the Dashboard) will
   succeed and is safe — the handler is idempotent by design (see
   `tests/integration/webhook-idempotency.test.ts`).
3. If an order is genuinely stuck (all retries exhausted, Stripe gives up):
   find the Stripe Checkout Session in the Dashboard, confirm it actually
   shows `payment_status: paid`, and manually replay via
   `stripe events resend evt_...` (Stripe CLI) once the root cause is
   fixed — do not hand-write the Order row; let the real handler create it
   so inventory/reservation state stays consistent.

## Suspected oversold inventory

**Symptom**: `InventoryLevel.quantity` is negative, or a size shows as
available in the admin but two customers both got confirmation emails for
the last unit.

1. This should be structurally impossible for online sales — the CHECK
   constraint on `InventoryLevel` (see `docs/DATABASE_MIGRATIONS.md`)
   prevents `quantity < 0` at the database level, and
   `tests/integration/inventory-concurrency.test.ts` verifies the
   reservation path can't double-allocate the same unit. If it happened
   anyway, it's either (a) a manual/admin adjustment that bypassed
   `adjustInventory()`, or (b) a genuine bug — treat as a P1, not routine.
2. Query `InventoryTransaction` for the affected `variantId`/`locationId`,
   ordered by `createdAt` — every quantity change is logged there with a
   `type` and `reference`, so the exact sequence of events that led to the
   negative count is always reconstructable.
3. Do not silently "fix" the number with a manual `UPDATE`. Use
   `adjustInventory()` (via the admin Inventory page's "Adjust" action,
   type `MANUAL_ADJUSTMENT`) so the correction itself is also audited.
4. If a real oversell reached a customer (order confirmed, stock wasn't
   actually there): this is a fulfillment/customer-service problem, not a
   data problem — the order and payment are still correct and valid; it
   needs a human decision (backorder, substitute, or refund + apologize),
   not a database fix.

## Stuck/failed migration

See `docs/DATABASE_MIGRATIONS.md` → "Handling a failed migration" and
"Rollback / recovery procedure" — covered there in full, not duplicated
here.

## Suspected compromised admin account

1. In `prisma studio` (or a direct query), set that `User.active = false`
   — every admin Server Action's `requireStaff()` check should be extended
   to also verify `active` before trusting a role (verify this is actually
   wired before relying on it — see the final readiness report for current
   status).
2. Rotate `AUTH_SECRET` in the production environment — this immediately
   invalidates every issued JWT session (JWT sessions are signed with this
   secret; changing it makes all existing tokens fail verification), which
   force-logs-out every signed-in user, staff and customer alike. This is
   blunt but immediate; there's no per-session revocation with JWT
   strategy sessions.
3. Review `InventoryTransaction`/`Refund`/order-mutation history for
   anything the compromised account touched, using `createdByUserId`.

## Stripe key exposure

1. Roll the key immediately in the Stripe Dashboard (Developers → API
   keys → "Roll key") — this invalidates the old one instantly.
2. Update `STRIPE_SECRET_KEY` in Vercel's production environment variables
   and redeploy.
3. If the webhook signing secret was also exposed, roll that too
   (Developers → Webhooks → the endpoint → "Roll secret") and update
   `STRIPE_WEBHOOK_SECRET`.
4. Check Stripe's Dashboard for any unrecognized API activity in the
   exposure window.

## General principle

Every mutation in this system (`InventoryTransaction`, `StripeEvent`,
`Refund`, order status changes) is designed to leave an audit trail
specifically so incidents are reconstructable after the fact. When in
doubt, query the audit trail before guessing.
