# Operator Setup Checklist

Written for whoever is doing the actual account creation and clicking —
not assuming developer background. Each section links to a focused doc
with the full steps; this page is the map and the "how do I know it
worked" summary.

Do this in order — later steps assume earlier ones are done.

---

## 1. Neon (database)

**Where to go:** neon.tech (or Vercel → Storage → Neon)
**What to create:** two projects — `jgp-staging`, `jgp-production`
**What to copy:** pooled connection string, direct connection string (both, per project)
**Env variable names:** `DATABASE_URL`, `DIRECT_URL`
**Where to paste it:** Vercel → Settings → Environment Variables — staging project's values into **Preview**, production project's values into **Production**; also `.env.local` for your own machine (staging values)
**How to test it:** `npm run db:check`
**Success looks like:** `Reachable: yes`
Full steps: `docs/NEON_SETUP.md`

## 2. Stripe (payments)

**Where to go:** dashboard.stripe.com
**What to create:** nothing to "create" beyond the account — just switch to Test mode and copy keys
**What to copy:** Secret key, then a webhook signing secret (from `stripe listen` locally, or a Dashboard webhook endpoint for Preview)
**Env variable names:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
**Where to paste it:** `.env.local` (test), Vercel Preview scope (test) — live keys go into Production only after everything below passes
**How to test it:** `docs/STRIPE_TESTING.md` full procedure
**Success looks like:** one test purchase creates exactly one Order, inventory decrements once
Full steps: `docs/STRIPE_ACTIVATION.md`

## 3. Upstash (rate limiting)

**Where to go:** console.upstash.com (or Vercel → Storage → Upstash)
**What to create:** one Redis database
**What to copy:** REST URL, REST token
**Env variable names:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
**Where to paste it:** Vercel Preview + Production scopes
**How to test it:** hit `/api/checkout` more than 20 times in 10 minutes from the same IP
**Success looks like:** requests beyond the limit get HTTP 429
Full steps: `docs/UPSTASH_SETUP.md`

## 4. Resend (email)

**Where to go:** resend.com
**What to create:** account + a verified sending domain/subdomain
**What to copy:** API key
**Env variable names:** `RESEND_API_KEY`, `EMAIL_FROM`
**Where to paste it:** Vercel Preview + Production scopes
**How to test it:** register on staging with an email that has existing guest-order history; check Resend's Dashboard → Emails log
**Success looks like:** a "Delivered" entry, and the email actually arrives
Full steps: `docs/RESEND_SETUP.md`

## 5. Vercel Blob (product images)

**Where to go:** Vercel project → Storage tab
**What to create:** a Blob store (one click — "Create Database" → "Blob")
**What to copy:** nothing — Vercel auto-populates the token
**Env variable name:** `BLOB_READ_WRITE_TOKEN`
**Where to paste it:** auto-populated; copy into `.env.local` for local dev only if needed
**How to test it:** upload a product image via `/admin/products/[id]`
**Success looks like:** the image renders on the live product page
Full steps: `docs/BLOB_SETUP.md`

## 6. Vercel (hosting)

**Where to go:** vercel.com → New Project → import this GitHub repo
**What to create:** the Vercel project itself
**What to copy:** N/A — this step is where you paste everything from 1–5 above
**Where to paste it:** Settings → Environment Variables, using the scope table in `docs/VERCEL_SETUP.md`
**How to test it:** `STAGING_URL=<preview-url> npm run verify:staging`
**Success looks like:** 5+ of 7 checks PASS immediately (2 need a working database — see step 1); all 7 PASS once the database is migrated and seeded
Full steps: `docs/VERCEL_SETUP.md`

## 7. Secrets not covered above

Generate locally, no external account needed:
```bash
openssl rand -base64 32
```
Use the output for `AUTH_SECRET` (one value) and `CRON_SECRET` (a
different value) — different value per Vercel environment (Preview vs.
Production) for `AUTH_SECRET` specifically, since anyone who has it can
forge a session.

## 8. Preview deployment

Once 1–7 are done for staging/Preview: push to a branch, open a PR (or
push to a non-production branch) — Vercel deploys a Preview automatically.
Grab the URL from the Vercel dashboard or the PR's Vercel bot comment.

## 9. Staging validation

```bash
npx prisma migrate deploy   # against the staging DB
npm run db:seed:staging     # writes down the printed admin/staff/customer passwords
npm run test:commerce       # requires DATABASE_URL pointed at staging
STAGING_URL=https://<preview-url> npm run verify:staging
```
Then walk through `docs/LAUNCH_RUNBOOK.md`'s pre-cutover steps and the
manual Playwright/browser pass once staging is confirmed reachable.

## 10. Production activation

Only after 1–9 are fully green: repeat steps 1–5 for **Production**-scoped
values (separate Neon project, live Stripe keys, etc. — see the scope
table in `docs/VERCEL_SETUP.md`), then follow `docs/LAUNCH_RUNBOOK.md`
from T-24 HOURS onward.

---

No real secret values appear anywhere in this document, on purpose — only
where each one goes.
