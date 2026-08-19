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

Not yet run — requires `DATABASE_URL` pointed at a real Postgres (see
`docs/NEON_SETUP.md`). Run with:
```bash
npm run test:commerce
```

## Webhook idempotency (`tests/integration/webhook-idempotency.test.ts`)

Not yet run — same blocker as above.

## Refund concurrency (`tests/integration/refund-concurrency.test.ts`)

Not yet run — same blocker as above.

## Stripe test-mode purchase

Not yet run — requires Stripe test keys (see `docs/STRIPE_ACTIVATION.md`)
and a reachable staging deployment. Full procedure:
`docs/STRIPE_TESTING.md`.

## Return / Exchange runtime walkthrough

Not yet run — requires staging database + a paid test order to return.

## Live production test order

Not yet run — this is the last gate before considering launch complete.
Procedure: `docs/LAUNCH_RUNBOOK.md` T+1 HOUR section.
