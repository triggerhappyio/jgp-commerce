# le bal OS ↔ jgp-commerce — Reconciled Architecture

**As of 2026-09-05.** This document reconciles the "le bal OS" operating
blueprint (`lebal_architectural_polish_v7.docx` — internal shop-ops
system: customer visits, foot assessments, footprint archive,
appointments, inventory ledger, staff RBAC, Square/Clover in-store
checkout) with the existing jgp-commerce codebase (this repo — online
storefront: Next.js, Prisma, Neon Postgres, Stripe, NextAuth). le bal and
JGP are the same business; this reconciles them into one platform instead
of two.

## The core call: extend this stack, don't stand up Supabase

The le bal OS memo specifies Next.js + **Supabase** (Postgres, Auth,
Storage) as its backend. That would create a second live database for
the same business's customers, products, and inventory — which is
exactly the "data fragmentation" problem the memo itself opens by
describing (three disconnected Airtable tables). Standing up Supabase
alongside the already-built, already-tested Neon/Prisma backend trades
one fragmentation problem for another, worse one: two systems of record
for the same customer and the same SKU, needing to be kept in sync
forever.

**Recommendation:** extend the existing Next.js/Prisma/Neon/NextAuth
stack with the operational entities le bal OS needs, rather than
introducing Supabase. Section-by-section justification below — in most
categories the existing schema already meets or exceeds what the memo
calls for.

## Reuse map — what already exists vs. what's genuinely new

| le bal OS requirement | Status in jgp-commerce | Action |
|---|---|---|
| Unified customer record, phone+email matching | `Customer` model exists (`email` unique; `phone` present but not unique-constrained) | Add a unique/partial-unique constraint on `phone` where non-null, per the memo's dedup rule |
| Staff records + RBAC | `User.role`: `CUSTOMER/STAFF/MANAGER/ADMIN/SUPER_ADMIN`, already enforced in 3 independent layers (edge middleware, layout, every Server Action) | Reuse directly — this is more rigorous than the memo's own "Supabase Auth managing staff and customer roles" |
| Business location / app config | `InventoryLocation` already has real rows (Koreatown, Buena Park, Warehouse, Online) | Add a small `AppConfig` singleton table for messaging defaults etc. — genuinely new but tiny |
| Products / SKUs | `Product` / `ProductVariant`, Korean mm sizing already modeled | Reuse directly — no separate catalog |
| Inventory ledger (immutable, audited) | `InventoryLevel` + `InventoryTransaction` + `Reservation`, atomic guarded-SQL decrement, DB-level CHECK constraint against negative stock | **Already exceeds the memo's spec.** The memo's "ledger" requirement is a lighter version of what's already built and integration-tested (`tests/integration/inventory-concurrency.test.ts`) |
| Stock take / cycle count | Not built | New: a `StockTakeSession` + reuse `InventoryTransaction` with a `type: CORRECTION` row per counted variant (the enum already exists — check `InventoryTransactionType`) |
| Appointments | `Consultation` exists but is a bare lead-capture form — no `customerId`/`staffId` FK, no real status workflow | Needs real restructuring — see "New models" below |
| Visits (customer+staff+date session) | Not built | New model |
| Assessments (structured, per-visit) | Not built | New model |
| Footprints (files + metadata, per-visit) | `FootProfile` exists but is **1:1 with Customer** — a single current snapshot, not a repeatable per-visit history | Needs restructuring from 1:1 to 1:many, keyed to `Visit` — see below |
| Recommendations (SKU tied to a visit) | Not built | New model, FK to `Visit` + `ProductVariant` |
| Purchase history unified across channels | `Order.source` enum **already includes `RETAIL`** alongside `JGP_WEB` | This is the single strongest piece of evidence the original schema was already designed to absorb in-store sales — reuse `Order`/`OrderItem`/`Payment` as-is for retail transactions too |
| Square/Clover payment events, idempotent | `StripeEvent` (unique event id, dedup) is the exact pattern needed | New: a provider-agnostic sibling table (`PosEvent` or generalize `StripeEvent` → `PaymentProviderEvent`), same shape |
| Reconciliation queue for unmatched sales | Not built | New model (`SyncError` / `ReconciliationItem`) |
| Audit log (general, beyond inventory) | Inventory already has its own audit trail (`InventoryTransaction`); nothing general-purpose exists yet | New model, or extend the inventory pattern to cover footprint uploads and other staff actions the memo calls out |
| Customer magic-link portal | NextAuth Credentials-only today; no passwordless flow | New: NextAuth Email/magic-link provider (NextAuth supports this natively — no need for Supabase Auth to get it) |
| Object storage for footprint scans | `lib/storage.ts` (Vercel Blob) already built, just not activated with a real token yet | Reuse directly — this is exactly what it's for |

## Payment channels: not actually in conflict

Stripe (online, `jgpusa.store`) and Square/Clover (in-store, physical
registers) are different channels for the same business, not competing
choices for the same job. Keep Stripe exactly as built and tested for
online checkout. Add Square/Clover webhook ingestion for in-store sales,
modeled directly on the existing, proven Stripe webhook pattern
(`app/api/webhooks/stripe/route.ts`): verify signature → idempotency
check against a `PaymentProviderEvent` table → create `Order` with
`source: RETAIL` → decrement inventory through the same
`reserveInventory`/`commitReservationsForAttempt` functions already used
by online checkout, so a sale is a sale regardless of which register it
came from. The memo's own suggestion to route Square/Clover webhooks
through Make.com for normalization first is reasonable and can stay —
Make.com becomes the thing that calls this app's new endpoint, not a
replacement for the app doing the actual database writes.

## New Prisma models needed

```prisma
model Visit {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  staffId     String
  staff       User     @relation(fields: [staffId], references: [id])
  locationId  String
  location    InventoryLocation @relation(fields: [locationId], references: [id])
  appointmentId String? @unique
  appointment   Appointment? @relation(fields: [appointmentId], references: [id])
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  notes       String?

  assessment      Assessment?
  footprints      Footprint[]
  recommendations Recommendation[]
}

model Appointment {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  locationId  String
  location    InventoryLocation @relation(fields: [locationId], references: [id])
  scheduledAt DateTime
  status      AppointmentStatus @default(SCHEDULED) // SCHEDULED/CONFIRMED/COMPLETED/CANCELED/NO_SHOW
  notes       String?
  createdAt   DateTime @default(now())

  visit Visit?
}

model Assessment {
  id        String   @id @default(cuid())
  visitId   String   @unique
  visit     Visit    @relation(fields: [visitId], references: [id])
  data      Json     // structured assessment fields — start flexible, tighten once the real intake form is finalized
  createdAt DateTime @default(now())
}

model Footprint {
  id        String   @id @default(cuid())
  visitId   String
  visit     Visit    @relation(fields: [visitId], references: [id])
  fileUrl   String   // Vercel Blob URL
  side      String?  // "left" | "right" | "both"
  createdAt DateTime @default(now())

  @@index([visitId])
}

model Recommendation {
  id               String        @id @default(cuid())
  visitId          String
  visit            Visit         @relation(fields: [visitId], references: [id])
  productVariantId String?
  productVariant   ProductVariant? @relation(fields: [productVariantId], references: [id])
  notes            String?
  outcome          String?       // purchased / declined / pending — reconcile against Order later
  createdAt        DateTime      @default(now())
}

model PaymentProviderEvent {
  id          String    @id @default(cuid())
  provider    String    // "square" | "clover"
  providerEventId String @unique
  type        String
  payload     Json
  processedAt DateTime?
  error       String?
  createdAt   DateTime  @default(now())

  @@index([provider, type])
}

model ReconciliationItem {
  id          String   @id @default(cuid())
  providerEventId String
  reason      String   // e.g. "no matching SKU", "no matching customer"
  status      String   @default("open") // open | resolved
  resolvedBy  String?
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())
}
```

`Consultation` should be retired in favor of `Appointment` once the
migration is written — it's the same concept with a weaker shape (no
FKs, no real status enum).

## New route groups

- **`/ops`** (or extend `/admin`) — the Internal OS: visit intake,
  assessment entry, footprint upload, recommendation creation, stock
  take. Reuse the exact same defense-in-depth auth pattern already built
  for `/admin` (edge middleware + layout re-check + per-action
  `requireStaff()`), not a new auth system.
- **Customer magic-link access** — either a lighter mode of the existing
  `/account`, or a new `/portal`, backed by NextAuth's built-in Email
  provider (magic links), not a second auth system. The existing
  `Customer`/`User` split already supports this: a `Customer` row
  doesn't strictly require a `User` row today (`userId` is nullable) —
  worth revisiting whether every in-store customer should get a `User`
  row at intake so magic-link access works without a separate signup
  step.

## Design manifesto (Section 19 of the memo)

The typographic hierarchy (serif for brand/editorial, sans/mono for
workflow/metadata), the `LOC: LA_KOREATOWN.01_ATELIER` identity anchor,
bilingual EN/KO handling, and the isolated-showroom product photography
rule are real, valuable, and orthogonal to all of the above — they're a
design-system task (Tailwind tokens, typography scale, photography
guidelines) that applies equally whether the backend is Supabase or this
stack. Nothing above blocks starting that work in parallel.

## Revised phased roadmap (grounded in actual current state)

The memo's Phase 0–4 roadmap assumes starting from zero. Adjusted for
what's already built:

- **Phase 0 — Data cleanup (as memo'd, unchanged):** SKU normalization,
  customer dedupe, opening stock take. This has to happen regardless of
  backend choice and isn't shortened by reusing this stack.
- **Phase 1 — Schema + Internal OS shell (shorter than memo'd):** add the
  new models above via a real Prisma migration, build `/ops` reusing
  existing auth/layout patterns. No new auth system, no new database to
  provision — this is the biggest time savings versus the original plan.
- **Phase 2 — Square/Clover sync (as memo'd, same shape):** webhook
  ingestion modeled on the existing idempotent Stripe pattern, Make.com
  in front for normalization if desired.
- **Phase 3 — Customer portal (shorter than memo'd):** NextAuth Email
  provider for magic links instead of standing up Supabase Auth; reuse
  `/account`'s existing order-history rendering, extend with visit/
  footprint/recommendation history.
- **Phase 4 — Design polish (as memo'd, unchanged):** typography,
  localization, showroom photography, motion — independent of backend.

## Open decisions for JGP to make (not made here)

- Should every walk-in customer get a `User` row at intake (enabling
  magic-link portal access immediately), or only on request?
- Square vs. Clover vs. both, ongoing — the memo says Clover specifically
  for insurance-related transactions; confirm that's still the real
  workflow before building two integrations instead of one.
- Whether `Assessment.data` stays a flexible JSON blob long-term or gets
  a proper structured schema once the real in-store intake form is
  finalized — starting flexible is deliberate, not a placeholder to fix
  immediately.
