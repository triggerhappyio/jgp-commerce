# Neon (PostgreSQL) Setup

1. Go to **neon.tech**, create an account (or use the **Vercel Marketplace**
   → Storage → Neon integration, which does steps 1–5 for you and
   auto-populates the env vars in step 5).
2. Create **two separate projects**: `jgp-staging` and `jgp-production`.
   Never share one database between them.
3. In each project, open the default branch's connection details.
4. Copy the **pooled connection string** (has `-pooler` in the hostname).
5. Copy the **direct connection string** (no `-pooler`) — Prisma migrations
   need the direct connection; the app itself uses the pooled one.
6. Set, per environment:
   ```
   DATABASE_URL=<pooled connection string>
   DIRECT_URL=<direct connection string>
   ```
   - Local dev: `.env.local`
   - Vercel Preview: Vercel project → Settings → Environment Variables →
     scope to **Preview** → use the **staging** project's URLs
   - Vercel Production: scope to **Production** → use the **production**
     project's URLs
   - **Never put the production project's URLs in the Preview scope.**
7. Run the staging migration:
   ```bash
   npx prisma migrate deploy
   npx prisma migrate status
   ```
   Both must succeed with no pending/failed migrations before continuing.
8. Verify: `npm run db:check` — should print `Reachable: yes` and a table
   count (0 products is expected before seeding/import).
9. Seed staging only: `npm run db:seed:staging` (prints generated admin/
   staff/customer passwords to the terminal — copy them somewhere safe,
   they aren't stored anywhere and re-running the script rotates them).
   **Never run this against the production project.**

## Test it worked

```bash
npm run db:check
```
Success looks like: `Reachable: yes` followed by a `Products: N  Orders: N  Users: N` line.
