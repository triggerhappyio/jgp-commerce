# Launch Hardening — Pre-Upgrade Checkpoint

Rollback point: git commit `181cf61` ("Pre-upgrade checkpoint..."). If the
Next.js upgrade below causes problems that can't be resolved quickly,
`git reset --hard 181cf61` (or `git revert` the upgrade commit once it
exists) returns to this known-good state.

## PRE-UPGRADE STATE

Environment: Node v24.15.0, npm 11.12.1, Windows, no Docker, no local
PostgreSQL, no Stripe/Neon/Upstash/Resend/Vercel credentials.

## DEPENDENCY STATE (before)

```json
"dependencies": {
  "@prisma/client": "^5.20.0",
  "bcryptjs": "^3.0.3",
  "next": "14.2.15",
  "next-auth": "^5.0.0-beta.32",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "stripe": "^16.12.0"
},
"devDependencies": {
  "@playwright/test": "^1.62.1",
  "@types/bcryptjs": "^2.4.6",
  "@types/node": "^20",
  "@types/react": "^18",
  "@types/react-dom": "^18",
  "eslint": "^8.57.1",
  "eslint-config-next": "^14.2.15",
  "prisma": "^5.20.0",
  "tsx": "^4.23.12",
  "typescript": "^5",
  "vitest": "^4.1.11"
}
```

## KNOWN BLOCKERS (before)

1. `next@14.2.15` — large accumulated CVE list including an authorization-
   bypass-in-middleware advisory relevant to `/admin` gating.
2. No migration ever run against real PostgreSQL.
3. No Stripe test-mode purchase ever made.
4. Returns/exchanges: data model only, no admin workflow.
5. Rate limiting: in-memory, single-process only.
6. Email: interface only (`lib/email.ts`), no provider.
7. Object storage: not configured.
8. 17 lint findings (all cosmetic `react/no-unescaped-entities`).

## Passing commands (before, evidence)

```text
npx prisma validate      → PASS
npx tsc --noEmit          → PASS (exit 0)
npm run build             → PASS (31 routes, correct static/dynamic split)
npx vitest run            → 8 real tests pass, 6 integration tests honestly
                             SKIP (no DATABASE_URL)
npm run lint               → runs, 17 cosmetic findings, 0 functional/security
```

## Dynamic-route / async-request-API inventory (before upgrade)

Files destructuring `params` or `searchParams` as page/route props — these
are exactly what Next.js 16's async request APIs require migrating:

```text
app/shop/[slug]/page.tsx                                   (params)
app/admin/(dashboard)/orders/[id]/page.tsx                  (params)
app/admin/(dashboard)/orders/page.tsx                        (searchParams)
app/admin/(dashboard)/customers/[id]/page.tsx                (params)
app/admin/(dashboard)/customers/page.tsx                     (searchParams)
app/admin/(dashboard)/products/[id]/page.tsx                 (params)
app/admin/(dashboard)/inventory/page.tsx                     (searchParams)
app/admin/(dashboard)/inventory/[variantId]/history/page.tsx (params)
app/account/page.tsx                                          (searchParams)
```

`app/api/auth/verify-email/route.ts` uses `req.nextUrl.searchParams`
(reading the request URL directly) — **not** affected by the async-props
change; that API stays synchronous.

No direct `cookies()`/`headers()`/`draftMode()` calls exist in application
code (NextAuth handles session/cookie access internally).

## TARGET STATE

```text
next: 16.3.1 (latest stable at time of upgrade, exceeds the >=16.2.11
      security baseline)
Node: 24 LTS (already the runtime in this environment; pinned explicitly
      in package.json/.nvmrc for CI and Vercel)
```

See the rest of this pass's changes below this checkpoint for what
actually landed; this document captures only the *before* state.
