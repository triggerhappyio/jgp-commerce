# Shopify Migration Plan

**Do not shut down Shopify before every step below is complete and this
app's production checkout has actually processed real orders correctly.**
Shopify stays the live storefront until cutover; this app runs in parallel
until it's proven.

## 1. Products

| Shopify | This app |
|---|---|
| Product | `Product` |
| Variant | `ProductVariant` (one row per color+size combination) |
| SKU | `ProductVariant.sku` — must be unique; if Shopify has any duplicate/blank SKUs, resolve those in the export before import, since this app enforces uniqueness at the database level |
| Price | `ProductVariant.priceCents` (integer cents — Shopify's export is decimal dollars, multiply by 100 and round) |
| Images | `ProductImage.url` — Shopify's CDN URLs can be used directly at first (no re-hosting required to launch), or migrated to real storage once one is wired in (see README "Not built yet") |
| Status | `Product.status` (`DRAFT`/`ACTIVE`/`ARCHIVED`) — map Shopify's "active"/"draft"/"archived" directly |

Write a one-off script (pattern: `prisma/seed.ts`, but reading Shopify's
CSV/API export instead of hardcoded data) that upserts by `sku` — safe to
re-run as the export is refined. Do not hand-edit production data through
`prisma studio` for a catalog this size; script it.

**Do not import Shopify inventory quantities as-is without a final
reconciliation count** — see "Inventory" below; the export is a snapshot
that goes stale the moment it's taken.

## 2. Customers

| Shopify | This app |
|---|---|
| Customer | `Customer` (commerce profile) — a `User` (login) is created separately only when someone registers |
| Email/name/phone | Direct mapping |
| Addresses | `Address`, one row per Shopify address |
| **Passwords** | **Cannot be migrated — Shopify does not export password hashes, and this app uses a different hashing scheme (bcrypt) than Shopify's anyway.** Customers must reset/create a password on first login post-cutover. Do not tell customers their password "carried over" — it did not and cannot. |

Customer accounts should be created without a `User` row initially (guest-
style `Customer` records) — a customer only gets a `User`/password when
they actually register post-cutover, using the same guest-order-claiming
flow already built for organic guest checkouts (`app/api/auth/register`).
This means: import all Shopify customers as `Customer` rows now; nobody
needs to "migrate" a login, they just register normally later and their
history attaches automatically via the existing verified-email claim flow.

## 3. Orders

Historical orders are **read-only history**, not live commerce data:

- Import as `Order` + `OrderItem` rows with `legacyShopifyOrderId` set
  (field already exists on `Order`) so support can always trace back to
  the original Shopify order number.
- Use the real historical `unitPriceCents`/`totalCents` from Shopify at
  time of sale — `OrderItem` is an immutable snapshot by design (see
  `docs/DATABASE_MIGRATIONS.md`), which is exactly the shape historical
  orders need.
- **Do not replay historical inventory effects.** A 2024 Shopify order
  should not decrement 2026 inventory counts on import — set inventory
  from the final reconciled snapshot (step 4) directly, independent of how
  many historical orders exist.
- Payment/refund history from Shopify Payments (or whatever processor was
  used) is a separate system from Stripe — do not attempt to create fake
  `Payment`/`Refund` rows pointing at nonexistent Stripe objects. If order-
  level payment history matters for support, store it as a note/reference,
  not as a row implying it went through this app's Stripe integration.

## 4. Inventory

1. **Freeze** — pick a cutover instant. Stop taking new Shopify orders (or
   accept the small reconciliation gap below) at that instant.
2. **Final export** — pull Shopify's inventory counts per SKU per location
   at the freeze instant.
3. **Reconcile** — for any physical location that maps to a location in
   this app (Koreatown, Buena Park, Warehouse), set `InventoryLevel.quantity`
   to the reconciled count, logged as one `InventoryTransaction`
   (`type: RECEIVING`, `reason: "Shopify migration cutover count"`) per
   variant/location — never a silent bulk `UPDATE` with no audit trail.
4. Orders placed in the gap between "final export" and "app goes live"
   (if any) need manual reconciliation — there is no way to avoid this
   without a true zero-downtime cutover, which isn't necessary for a
   business this size; keep the gap short (minutes, via a maintenance
   page) instead.

## 5. Domain

- `jgpfootwear.store` is canonical (per README).
- Point DNS at Vercel only after production checkout has been verified
  end-to-end (see `docs/STRIPE_TESTING.md` "Production activation" and the
  final readiness report's launch gate).
- `jgpusa.store` (and both `www.` variants) should 301-redirect to the
  canonical domain — configure via Vercel's domain redirect settings, not
  application code, so it isn't hardcoded into business logic.

## 6. Launch sequence

```text
1. This app's production checkout passes every gate in the final
   readiness report (real Postgres migration, real Stripe test purchase,
   duplicate-webhook test, inventory concurrency test — all actually run,
   not just code-reviewed).
2. Products + customers + historical orders imported (steps 1-3 above).
3. Final inventory export + reconciliation (step 4) — do this LAST,
   as close to DNS cutover as practical, to minimize the reconciliation gap.
4. DNS cutover (step 5).
5. Smoke test: place one real order through the live domain.
6. Observe for a real business day or two before considering Shopify
   shutdown — keep Shopify accessible (even if not receiving traffic) as
   a fallback during this window.
7. Only after the observation period: cancel/downgrade the Shopify
   subscription. Do not do this same-day as cutover.
```
