# Validation Results

Evidence log for runtime tests that need real infrastructure (database,
Stripe, Redis, email, storage). Fill in each section as it's actually run
— never mark something done here without the corresponding command output.
Never paste secret values into this file.

## Template — copy this block per test run

```text
### <Test name>
Date/time:
Environment: staging | production
Command run:
Result: PASS / FAIL
Evidence (counts, output excerpt — no secrets):
```

---

## Inventory concurrency (`tests/integration/inventory-concurrency.test.ts`)

```text
Date/time: 2026-09-04
Environment: staging (Neon project jgp-staging via Vercel-managed integration,
             connected to jgp-commerce Vercel project)
Command run: npm run test:commerce
Result: PASS
Evidence: ON_HAND=1 concurrent-reservation test — exactly one of two
          simultaneous attempts succeeded, reserved never exceeded 1,
          available never went negative. Release-then-reserve-then-commit
          test — ended at ON_HAND=0/RESERVED=0, exactly one SALE
          InventoryTransaction, one Order, one Payment.
```

**Defect found and fixed during this run**: Prisma's default 5000ms
interactive-transaction timeout was too tight for the webhook's
multi-step transaction against real (non-local) Neon latency — a genuine
latent production bug, not a test artifact. Fixed by adding explicit
`{ timeout: 15000-30000 }` to every multi-step `$transaction` call in the
checkout/webhook/returns/product-creation paths (see commit history).
First run also surfaced a test-fixture bug (a hardcoded, non-unique
`InventoryLocation.name` in two test files colliding with leftover data
from an earlier failed run) — fixed by timestamping those names to match
the already-timestamped `code` field.

## Webhook idempotency (`tests/integration/webhook-idempotency.test.ts`)

```text
Date/time: 2026-09-04
Environment: staging (same as above)
Command run: npm run test:commerce
Result: PASS
Evidence: Invalid signature rejected (400). Duplicate event replay: +0
          orders, +0 payments, +0 inventory decrement (started at 5,
          ended at 4 — decremented exactly once across both the original
          and replayed delivery). Unpaid checkout.session.completed
          (delayed-payment scenario): 0 orders created, reservation
          stayed ACTIVE.
```

## Refund concurrency (`tests/integration/refund-concurrency.test.ts`)

```text
Date/time: 2026-09-04
Environment: staging (same as above)
Command run: npm run test:commerce
Result: PASS
Evidence: Two simultaneous full-amount refund attempts on the same order
          — exactly one succeeded, total refunded equals the order total
          exactly once (not double).
```

Full suite (`npx vitest run`, unit + integration together): **14/14 passed, 0 skipped** — the first time this repository has run with zero tests skipped for lack of infrastructure.

## Stripe test-mode purchase

Not yet run — requires Stripe test keys (see `docs/STRIPE_ACTIVATION.md`)
and a reachable staging deployment. Full procedure:
`docs/STRIPE_TESTING.md`.

## Return / Exchange runtime walkthrough

Not yet run — requires staging database + a paid test order to return.

## Live production test order

Not yet run — this is the last gate before considering launch complete.
Procedure: `docs/LAUNCH_RUNBOOK.md` T+1 HOUR section.
