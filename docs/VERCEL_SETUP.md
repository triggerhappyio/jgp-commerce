# Vercel Setup

1. Go to **vercel.com**, connect this GitHub repository (New Project →
   Import Git Repository).
2. Framework preset: **Next.js** (auto-detected).
3. Node.js version: **24.x** — Vercel reads this from `engines.node` in
   `package.json` (already set to `>=24 <25`); confirm in Project Settings
   → General → Node.js Version if it doesn't auto-select 24.
4. Build command: leave as the framework default (`next build` via
   `npm run build`) — do not override unless a genuine reason comes up.
5. Install command: leave as the framework default (`npm install`, which
   runs `postinstall` → `prisma generate` automatically).
6. **Before the first deploy**, add every environment variable below,
   scoped correctly. Settings → Environment Variables → add one at a time,
   selecting the right scope checkbox(es) per row.

## Environment variables by scope

| Variable | Development | Preview | Production |
|---|---|---|---|
| `DATABASE_URL` | staging | staging | **production** (separate value) |
| `DIRECT_URL` | staging | staging | **production** (separate value) |
| `AUTH_SECRET` | any generated value | staging value | **separate** generated value |
| `STRIPE_SECRET_KEY` | test | test | **live** |
| `STRIPE_WEBHOOK_SECRET` | test (from `stripe listen`) | test (Preview endpoint) | **live** (Production endpoint) |
| `UPSTASH_REDIS_REST_URL` | optional | required | required |
| `UPSTASH_REDIS_REST_TOKEN` | optional | required | required |
| `RESEND_API_KEY` | optional | required | required |
| `EMAIL_FROM` | optional | required | required |
| `BLOB_READ_WRITE_TOKEN` | optional | required | required |
| `CRON_SECRET` | optional | required | required |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | the Preview URL | `https://jgpfootwear.store` |
| `STRIPE_AUTOMATIC_TAX_ENABLED` | `false` | `false` until tested | per `docs/TAX_SETUP.md` |
| `SHIPPING_STANDARD_AMOUNT_CENTS` | placeholder ok | real value | real value |
| `SHIPPING_FREE_THRESHOLD_CENTS` | placeholder ok | real value | real value |

"Required" above means: the corresponding feature fails closed (throws,
doesn't silently degrade) in that environment if missing — see
`lib/rate-limit.ts`, `lib/email.ts`, `lib/storage.ts`.

7. Deploy. The first deploy will build successfully even with an empty
   database (pages that need it render dynamically, not at build time —
   see `docs/PRODUCTION_CHECKLIST.md` BUILD section) — but won't be
   functionally complete until `db:migrate:deploy` has run against the
   linked database (see `docs/NEON_SETUP.md`).
8. After deploy, get the Preview URL from the Vercel dashboard and run:
   ```bash
   STAGING_URL=https://<preview-url> npm run verify:staging
   ```

## Do not do yet

Do not attach the `jgpfootwear.store` domain to this project until
`docs/LAUNCH_RUNBOOK.md`'s CUTOVER section — attaching the domain early
would put an unfinished/unverified deployment on the real domain.
