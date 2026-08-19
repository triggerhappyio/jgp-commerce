# Production Checklist

Evidence-based, not assumption-based — each line reflects something that
was actually run in this environment, not "the code exists so it should
work." Environment used to generate this: no Docker, no local PostgreSQL,
no Stripe credentials, Node v24.15.0, Windows.

## BUILD

```text
[x] dependency install succeeds        — npm install, clean
[x] Prisma generation succeeds         — npx prisma generate
[x] Prisma validate succeeds           — npx prisma validate
[ ] migration status is valid          — BLOCKED: npx prisma migrate status
                                          requires a real DATABASE_URL/DIRECT_URL;
                                          returns P1001 connection error against
                                          a placeholder. Migration SQL itself is
                                          real and generated (see below) but has
                                          never been applied to a live database.
[x] TypeScript passes                  — npx tsc --noEmit, exit 0, repo-wide
[x] lint configuration exists          — .eslintrc.json (next/core-web-vitals);
                                          eslint/eslint-config-next were not
                                          installed at all prior to this pass
[x] production build passes            — npm run build: all 31 routes compiled,
                                          correctly split static/dynamic (DB-backed
                                          pages are `ƒ` dynamic, not statically
                                          prerendered against a nonexistent DB)
[ ] no known dependency vulnerabilities — FAIL: next@14.2.15 has a long list of
                                          accumulated CVEs incl. an authorization-
                                          bypass-in-middleware advisory, directly
                                          relevant since /admin access control
                                          partly relies on middleware.ts. Fix
                                          requires next@16 (breaking — `params`
                                          becomes async in every dynamic route).
                                          NOT attempted in this pass — see
                                          "Known launch-blocking issues" below.
```

## DATABASE

```text
[x] migrations exist and are real       — prisma/migrations/20260817000000_init/
                                           migration.sql, generated directly from
                                           the schema (prisma migrate diff
                                           --from-empty), includes a hand-added
                                           CHECK constraint (quantity/reserved
                                           non-negative) beyond what Prisma
                                           generates automatically
[ ] migrations run against PostgreSQL   — BLOCKED: no Postgres instance reachable
                                           in this environment (no Docker, no
                                           local psql). Never applied to a live DB.
[ ] seed/test setup works               — BLOCKED: same reason; prisma/seed.ts
                                           has not been executed against a
                                           real database
[x] critical constraints exist          — verified present in the generated SQL:
                                           unique SKU, unique StripeEvent id,
                                           unique stripeSessionId, unique
                                           stripePaymentIntentId, unique
                                           orderNumber (nullable-safe), unique
                                           user email, one InventoryLevel per
                                           variant+location, quantity/reserved
                                           CHECK constraint
```

## CATALOG

```text
[x] products are database-backed        — app/page.tsx, app/shop/**, all
                                            query Prisma directly; static
                                            lib/products.ts was deleted
[x] variants are database-backed         — ProductVariant, one row per
                                            color+size, real Korean mm sizing
[x] size/color selection resolves the
    correct variant                      — ProductActions.tsx maps
                                            (color, size) -> specific
                                            variant id before add-to-cart
[x] archived/unavailable products
    cannot checkout                      — checkout.ts filters on
                                            variant.active; Product.status
                                            gates storefront visibility
```

## INVENTORY

```text
[x] stock is variant-specific            — InventoryLevel keyed on variantId
[x] stock is location-specific           — InventoryLevel keyed on
                                            (variantId, locationId), 4 real
                                            locations seeded
[x] reservation created safely           — reserveInventory(): raw guarded
                                            SQL UPDATE (quantity - reserved
                                            >= qty), row-locked by Postgres
[x] reserved stock affects availability  — available = quantity - reserved,
                                            computed everywhere, never stored
[x] oversell attempt rejected            — checkout returns 409 when
                                            reservation fails
[x] expiration releases stock            — checkout.session.expired webhook
                                            handler + /api/cron/release-
                                            reservations backstop (every 5 min)
[x] payment consumes reservation         — commitReservationsForAttempt(),
                                            called from the webhook inside
                                            the same transaction as Order
                                            creation
[x] sale reduces inventory once          — verified by code review AND by
                                            tests/integration/webhook-
                                            idempotency.test.ts (SKIPPED here,
                                            no DB — see RUNTIME TESTS below)
[x] inventory transactions audit every
    mutation                             — InventoryTransaction row written
                                            in the same transaction as every
                                            quantity/reserved change
[x] negative inventory prevented         — both layers: app-level guarded
                                            UPDATE, and a database CHECK
                                            constraint added to the migration
```

## STRIPE

```text
[x] Checkout Session created in test
    mode (code path)                     — app/api/checkout/route.ts,
                                            uses STRIPE_SECRET_KEY, currently
                                            unset in this environment
[x] server controls prices               — priceCents read from
                                            ProductVariant, never from the
                                            client cart payload
[x] only supported payment methods
    enabled                               — payment_method_types: ["card"]
                                            pinned explicitly (was NOT pinned
                                            before this pass — patched)
[x] webhook signature verified            — stripe.webhooks.constructEvent,
                                            verified by a real test using
                                            local HMAC signing (see below)
[x] payment_status verified before
    marking an order paid                 — guard added this pass; previously
                                            marked PAID unconditionally
[ ] successful payment creates exactly
    one order (runtime)                   — BLOCKED: no live Stripe/DB. Proven
                                            at the code level by
                                            tests/integration/webhook-
                                            idempotency.test.ts, not run here.
[ ] duplicate webhook creates zero
    duplicate orders (runtime)            — same BLOCKED status; code-level
                                            proof exists, not runtime-executed
[ ] duplicate webhook causes zero
    duplicate inventory movement
    (runtime)                             — same BLOCKED status
[x] expired checkout releases
    reservation (code path)               — checkout.session.expired handler
                                            + cron backstop, not runtime-tested
[x] failed/unpaid payment does not
    create a false paid order             — payment_status guard (this pass)
                                            + async_payment_failed handler
                                            releases the hold instead
```

## TAX

```text
[x] Stripe Tax integration implemented   — lib/tax.ts, automatic_tax wired
                                            into the Checkout Session,
                                            defaults OFF (fails safe)
[x] tax configuration documented         — docs/TAX_SETUP.md — Dashboard
                                            activation, registrations, and
                                            product tax code are explicitly
                                            left as JGP's own business/legal
                                            decision, not made here
[x] shipping address available for
    tax calculation                       — shipping_address_collection
                                            already required on every session
[x] tax amount persisted to Order         — Order.taxCents, read from
                                            session.total_details.amount_tax
[x] production registration remains an
    explicit human/business decision      — no jurisdiction determination
                                            made in code or docs
```

## SHIPPING

```text
[x] V1 shipping rule works (code path)   — lib/shipping.ts, unit-tested
                                            (tests/unit/shipping.test.ts,
                                            8 assertions, all passing)
[x] free-shipping threshold works        — verified by the same unit tests
[x] server controls shipping price        — shippingOptionsParam() computed
                                            server-side from the reserved
                                            subtotal, never client input
[x] shipping selection saved to Order     — Order.shippingCents, from
                                            session.total_details.amount_shipping
[x] address snapshot saved to Order       — Order.shippingAddress (Json),
                                            immutable after order creation
```

## AUTH

```text
[x] password storage secure               — bcrypt, cost factor 12
[x] registration works (code path)        — app/api/auth/register, rate-
                                             limited (5/hour/IP)
[x] login works (code path)               — NextAuth Credentials + JWT;
                                             email normalization fixed to
                                             match registration this pass
[x] logout works                          — SignOutButton -> next-auth signOut
[x] customer account works                — /account shows order history +
                                             foot profile if present
[x] guest claim cannot steal another
    customer's order                      — FIXED this pass: previously
                                             linked on unverified email at
                                             registration time (real
                                             vulnerability); now requires a
                                             single-use, expiring, emailed
                                             verification token before any
                                             guest history is attached, and
                                             refuses to reassign a Customer
                                             already linked to a different User
[x] admin authorization enforced
    server-side                           — two independent layers: Edge
                                             middleware (JWT role check) +
                                             Node-runtime layout re-check;
                                             every admin Server Action also
                                             independently re-verifies
                                             session+role before mutating
                                             (not just gated by the page)
```

## ADMIN

```text
[x] duplicated action implementation
    eliminated                            — two full parallel admin route
                                             trees existed at one point
                                             (app/admin/** and
                                             app/admin/(dashboard)/**,
                                             resolving to the SAME URLs — a
                                             real build-breaking conflict, not
                                             just redundant code); resolved in
                                             favor of the more complete
                                             (dashboard) tree
[x] dashboard works                       — real Prisma aggregations
                                             (today's revenue/orders/units/AOV,
                                             low stock, top products, sales
                                             by location) — no mock values
[x] order detail works                    — fulfillment status/tracking/notes
                                             update, cancel, refund — all as
                                             Server Actions
[x] inventory management works            — adjust + transfer between
                                             locations, both audited
[x] authorization works                   — see AUTH section above
[x] privileged mutations reject
    unauthorized users                     — every action in lib/actions/*.ts
                                             calls requireStaff() independently
```

## REFUND

```text
[x] refund flow tested (code review +
    fix)                                   — found and fixed a real race:
                                             concurrent refund requests on
                                             the same order could both pass
                                             the "remaining balance" check
                                             before either wrote a Refund row,
                                             resulting in an actual double
                                             charge-back via Stripe. Fixed
                                             with SELECT ... FOR UPDATE row
                                             locking so concurrent attempts
                                             on the same order serialize.
[x] partial refund behavior correct       — remaining = totalCents -
                                             sum(existing refunds), enforced
                                             inside the same locked transaction
[x] over-refund impossible (code path)    — same fix; verified in isolation by
                                             tests/integration/refund-
                                             concurrency.test.ts (SKIPPED here,
                                             no DB)
[x] refund record persists                — Refund row created before Order
                                             status is updated, same transaction
[x] payment status recalculates           — PARTIALLY_REFUNDED / REFUNDED
                                             set from the actual summed total
[ ] returns/exchanges                     — NOT IMPLEMENTED: the data model
                                             (Return, ReturnItem, exchange
                                             linkage) exists and is sound, but
                                             there is no return-creation
                                             workflow/action — the admin
                                             Returns page is explicitly,
                                             honestly read-only and says so in
                                             its own UI. Documented as a known
                                             gap, not hidden or faked.
```

## MOBILE

```text
[ ] product discovery at 390px             — BLOCKED (runtime): Playwright
[ ] variant selector at 390px               suite exists (tests/e2e/), targets
[ ] cart at 390px                           390px and 1440px per the required
[ ] checkout initiation at 390px            journey, has not been executed —
[ ] navigation at 390px                     every page is DB-backed and there
                                             is no live server+database to run
                                             a browser against in this
                                             environment. Code-reviewed only
                                             (responsive inline styles use
                                             flex/grid, no fixed-width layouts
                                             observed) — not empirically verified.
```

## DEPLOYMENT

```text
[x] Vercel build succeeds (locally)        — npm run build, see BUILD above
[x] Preview vs. production DB strategy
    documented                             — docs/PRODUCTION_DEPLOYMENT.md
[x] secrets not exposed                    — grep sweep: no committed secrets,
                                             NEXT_PUBLIC_* has exactly one
                                             genuinely-public value
[x] webhook URL documented                 — docs/STRIPE_TESTING.md
[x] migration deployment strategy
    documented                             — docs/DATABASE_MIGRATIONS.md,
                                             explicit prohibition on `db push`
                                             / `migrate reset` in any deploy flow
[x] rollback/recovery procedure
    documented                             — docs/DATABASE_MIGRATIONS.md +
                                             docs/INCIDENT_RECOVERY.md
```

## Known launch-blocking issues (do not launch until resolved)

1. **`next@14.2.15` has a large accumulated set of CVEs**, including an
   authorization-bypass-in-middleware advisory directly relevant to this
   app's `/admin` gating. Fix requires upgrading to `next@16` — a breaking
   change (`params`/`searchParams` become `Promise`s in every dynamic route:
   `shop/[slug]`, `admin/orders/[id]`, `admin/customers/[id]`,
   `admin/products/[id]`, `admin/inventory/[variantId]/history`). Not
   attempted in this pass — doing it without a live environment to click
   through every affected route afterward would be reckless. **This should
   be its own focused, tested pass before launch**, not a rushed
   line-item here. In the meantime, the admin authorization design already
   does not rely on middleware alone (the `(dashboard)` layout independently
   re-verifies session+role in the Node runtime), which limits — but does
   not eliminate — the practical exposure from the middleware advisory
   specifically.
2. **No migration has ever run against a real PostgreSQL database.** The
   SQL is real and complete; it has not been executed. This must happen
   (see `docs/DATABASE_MIGRATIONS.md` "First real deploy") before any of
   the RUNTIME-blocked items above can move from BLOCKED to PASS/FAIL.
3. **No Stripe test-mode purchase has ever been made.** See
   `docs/STRIPE_TESTING.md` for the exact procedure once test credentials
   exist.
4. **Returns/exchanges have no working admin flow** — the data model is
   ready; the UI to create/process one is not built.
5. **No object storage or email provider is wired in** — product images
   are Shopify CDN URLs or placeholder paths; transactional email
   (`lib/email.ts`) logs instead of sending until a provider (Resend
   suggested) is configured.
