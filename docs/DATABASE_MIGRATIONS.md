# Database Migrations

## Current state

`prisma/migrations/20260817000000_init/migration.sql` is the initial
migration — the real, complete DDL generated directly from
`prisma/schema.prisma` via:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

This is genuine, complete SQL (every table/enum/constraint/index in the
current schema), not a placeholder. **It has not yet been applied against a
real PostgreSQL database** — no live database was available in the
environment this was built in (confirmed: no Docker, no local `psql`, no
`DATABASE_URL`/`DIRECT_URL` pointing at a real instance). Before this can
be called verified, someone needs to run it against a real Postgres
instance and confirm it applies cleanly — see "First real deploy" below.

## Local development

```bash
npx prisma migrate dev --name <change-description>
```

This applies any pending migrations and, if the schema has changed since
the last migration, generates and applies a new one. Prisma will prompt
before anything destructive (e.g. a column drop that would lose data).

**Review the generated SQL before committing it.** `prisma/migrations/**/migration.sql`
is not obscured or regenerated on every run — it's meant to be read,
reviewed in PR, and is the actual source of truth for what the database
looks like. Committing a migration without reading it is how an
unreviewed `DROP COLUMN` ends up in production.

## Staging / production deployment

```bash
npx prisma migrate deploy
```

**Never** `prisma migrate dev` or `prisma db push` against staging or
production — both are development commands. `migrate dev` can prompt
interactively and will create a new migration on the fly if the schema
drifted, which is not what you want in a deploy pipeline. `db push` skips
the migration history entirely and can silently reset columns Prisma
thinks are "different" — it has no rollback story and no audit trail of
what changed.

`migrate deploy` only ever applies migrations that already exist in
`prisma/migrations/` and are already committed — nothing is generated at
deploy time. That's what makes it safe to run unattended in CI/CD.

### Prohibited in any deploy flow (staging or production)

```text
prisma db push
prisma migrate dev
prisma migrate reset       # drops and recreates the entire database
```

`migrate reset` is a development-only command for wiping a local/throwaway
database back to empty. There is no legitimate reason to run it against
staging or production; if a production migration needs to be undone, use
the rollback procedure below instead.

## Vercel deployment

Run `prisma migrate deploy` as part of the build/deploy step (a Vercel
"Build Command" override, or a dedicated deploy hook/GitHub Action step
before the app build) — **not** inside `next build` itself, since a
migration failure should stop the deploy loudly, not get swallowed into a
generic build failure. `postinstall` already runs `prisma generate`
(client generation, not a migration — safe to run on every install).

Preview deployments should point at a separate database (or a disposable
branch of one, e.g. Neon's branching), never at production — see
`docs/PRODUCTION_DEPLOYMENT.md`.

## Backup expectations

Before any production migration:

1. Confirm your Postgres provider's automatic backup/point-in-time-recovery
   is enabled (Neon, Supabase, and RDS all offer this — verify it's
   actually on, don't assume a default).
2. For anything beyond an additive change (new nullable column, new table),
   take a manual snapshot/backup immediately before running `migrate
   deploy`, even with PITR enabled — a manual checkpoint is faster to
   restore from than searching PITR for the right second.

## Rollback / recovery procedure

Prisma does not have a built-in "undo last migration" command — migrations
are forward-only by design. Recovery from a bad production migration:

1. **If the migration hasn't been applied yet** (caught in review/CI):
   delete the bad migration directory from `prisma/migrations/`, fix the
   schema, and regenerate with `migrate dev`. Nothing to roll back.
2. **If the migration was just applied and is additive** (new
   table/column/index): write and apply a new forward migration that drops
   the addition, rather than trying to rewind history. Migration history
   should stay linear.
3. **If the migration was destructive and already applied** (dropped/altered
   a column, lost data): restore from the pre-migration backup/PITR
   snapshot from "Backup expectations" above. This is why that step isn't
   optional for non-additive changes.
4. **If a migration partially applied and failed mid-way** (see below).

## Handling a failed migration

`prisma migrate deploy` runs each pending migration's SQL as-is. If one
fails partway (e.g. a constraint violation on existing data), Prisma marks
it as failed in its internal `_prisma_migrations` tracking table and
refuses to proceed until it's resolved:

```bash
# after fixing the underlying issue (data cleanup, corrected SQL, etc.)
npx prisma migrate resolve --applied "<migration-name>"   # if you fixed it manually and it's now correct
npx prisma migrate resolve --rolled-back "<migration-name>"  # if you reverted the partial change by hand
```

Both commands only update Prisma's bookkeeping — neither one touches the
database itself. Do the actual fix (via a hand-written SQL fix or a new
migration) first, then tell Prisma which one happened.

## First real deploy (do this before trusting `migrate deploy` in CI)

1. Point `DATABASE_URL`/`DIRECT_URL` at a real (can be a free-tier Neon/Supabase)
   database.
2. Run `npx prisma migrate deploy` and confirm it completes without error.
3. Run `npx prisma migrate status` — should report the `20260817000000_init`
   migration as applied, with no pending/failed migrations.
4. Run `npm run db:seed` and confirm the dev catalog seeds correctly.
5. Only then wire `migrate deploy` into the actual Vercel/CI deploy step.

## Data integrity enforced at the database level (not just app code)

The migration includes real Postgres constraints for everything the
original spec called out — these are `UNIQUE`/`NOT NULL`/foreign-key
constraints in the generated SQL, not just Prisma-level validation:

| Requirement | Enforced by |
|---|---|
| Unique SKU | `ProductVariant.sku` — `@unique` |
| Unique Stripe event id | `StripeEvent.stripeEventId` — `@unique` |
| Unique Stripe Checkout Session per order | `Order.stripeSessionId` — `@unique` |
| Unique payment intent per Payment | `Payment.stripePaymentIntentId` — `@unique` |
| Unique order number | `Order.orderNumber` — `@unique` (nullable, see schema comment on why) |
| Unique user email | `User.email` — `@unique` |
| One inventory row per variant+location | `InventoryLevel` — `@@unique([variantId, locationId])` |

Prisma's schema DSL has no `CHECK` constraint syntax, so one was added by
hand to the generated migration file (`quantity >= 0 AND reserved >= 0 AND
reserved <= quantity` on `InventoryLevel`) — a database-level backstop on
top of the atomic guarded `UPDATE ... WHERE quantity - reserved >= $qty`
pattern already in `lib/inventory.ts`. This means even a bug or a manual
`UPDATE` run directly against the database can't violate the invariant,
not just application code going through the normal path.

Hand-added SQL like this survives future `prisma migrate dev` runs fine —
Prisma only ever generates *new* migrations for schema changes going
forward; it doesn't rewrite migrations that already exist.
