# Production Deployment (Vercel)

This is the step-by-step for taking what's in this repo live. See
`docs/DATABASE_MIGRATIONS.md` for the migration-specific detail and
`docs/TAX_SETUP.md` / `docs/SHIPPING.md` for those two subsystems
specifically — this doc is the surrounding checklist.

## Environments

Three distinct database targets, never shared:

| Environment | Database | Stripe keys |
|---|---|---|
| Local dev | Your own Postgres (Neon/Supabase free tier is fine) | Test mode |
| Preview deployments (PRs) | A separate DB, ideally a disposable branch (Neon branching, or a second free-tier Supabase project) | Test mode |
| Production | Production Postgres | Live mode |

Never point a Vercel Preview deployment at the production database —
Preview builds run on every PR/push and a bug in a preview build should
never be able to touch real customer data or real inventory counts.

## First-time setup

1. **Database**: create the production Postgres instance (Neon or
   Supabase). Grab both the pooled connection string (`DATABASE_URL`) and
   direct connection string (`DIRECT_URL`) — see `docs/DATABASE_MIGRATIONS.md`.
2. **Run the initial migration** against it:
   ```bash
   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
   npx prisma migrate status   # confirm 20260817000000_init is applied, nothing pending
   ```
3. **Create the first staff account** — see README "Admin setup". Do this
   directly against production via `prisma studio` pointed at the
   production `DATABASE_URL`, or write a one-off authenticated script.
   There is deliberately no seed-created admin account.
4. **Do not run `npm run db:seed` against production** — it's dev-only
   demo catalog data (`W852`, `M808`, etc. with placeholder inventory
   counts). Populate the real catalog via the Shopify migration
   (`README.md` → "Shopify migration plan") or the admin Products UI.
5. **Stripe**: switch to live-mode keys only after step 8 (test purchase)
   has succeeded against this same production database in Stripe test
   mode. Going live with `STRIPE_SECRET_KEY=sk_live_...` before that is
   how untested code meets real money.
6. **Vercel project**: import the repo, set every variable from
   `.env.example` in Project Settings → Environment Variables, scoped to
   Production (and separately to Preview, pointed at the preview DB from
   the table above).
7. **Build command**: `prisma migrate deploy` must run before/during the
   build — see `docs/DATABASE_MIGRATIONS.md` "Vercel deployment". `next
   build` does not run migrations on its own.
8. **First live-mode test purchase**: place one real order end-to-end
   (session → webhook → Order → inventory decrement → admin order view)
   before announcing the site is live. Refund it via the admin order page
   afterward to confirm the refund path too.
9. **Webhook**: add `https://jgpfootwear.store/api/webhooks/stripe` in the
   Stripe Dashboard (live mode) once the domain is live, and copy that
   specific endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` in
   Vercel — this is a *different* secret from whatever `stripe listen`
   gave you locally.
10. **Cron**: `vercel.json` declares `/api/cron/release-reservations`
    (every 5 minutes) — Vercel wires this up automatically on deploy to a
    production domain; it does not run for Preview deployments. Confirm
    `CRON_SECRET` is set in Production env vars, or the route will 401
    itself (safe failure, but reservations won't get released until fixed).

## Every subsequent deploy

1. Merge to the production branch.
2. Vercel builds; `prisma migrate deploy` runs first (per your build
   command config) and applies any new migrations.
3. If a migration fails, the build should fail loudly (see
   `docs/DATABASE_MIGRATIONS.md` "Handling a failed migration") — do not
   configure it to swallow migration errors and deploy anyway.

## Domain cutover

See README "Domain structure" and "Shopify migration plan" step 5 — build
the old-URL → new-URL redirect map and set `NEXT_PUBLIC_APP_URL` to the
canonical domain *before* pointing DNS at Vercel, not after.

## Rollback

Application code: use Vercel's instant rollback to a previous deployment.
Database: migrations are forward-only — see `docs/DATABASE_MIGRATIONS.md`
"Rollback / recovery procedure" if a bad migration needs undoing. Rolling
back the app code does **not** roll back an already-applied migration;
the two need to be reasoned about separately.
