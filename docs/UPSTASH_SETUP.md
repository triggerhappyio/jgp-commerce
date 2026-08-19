# Upstash (Redis / rate limiting) Setup

Required in Preview and Production — `lib/rate-limit.ts` refuses to start
(throws) on any rate-limited route in those environments if this isn't
configured; it does not silently fall back to an in-memory limiter there.

1. Go to **console.upstash.com** (or Vercel Marketplace → Storage →
   Upstash, which auto-populates the env vars below).
2. Create a Redis database. Region: pick one close to where the app is
   deployed (Vercel's region, if fixed).
3. Open the database → REST API section.
4. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.
5. Set in Vercel: Settings → Environment Variables, scoped to **both
   Preview and Production** (a single Upstash database is fine to share
   across Preview and Production for rate limiting specifically — unlike
   the database or Stripe keys, rate-limit counters aren't sensitive
   business data, so sharing here is a reasonable simplification; use
   separate databases if you'd rather keep them fully isolated).
6. Redeploy (env var changes require a redeploy to take effect).

## Test it worked

Hit a rate-limited endpoint (e.g. `/api/checkout` or
`/api/auth/register`) more than its configured limit in quick succession
— see the limits in `app/api/checkout/route.ts` (20/10min) and
`app/api/auth/register/route.ts` (5/hour). Expected:

```
requests within the limit  -> normal response
requests over the limit    -> HTTP 429 "Too many ... Try again ..."
after the window resets    -> normal response again
```

Because Upstash is a real shared Redis (not per-process memory), this
holds even if the app is running across multiple serverless instances —
that's the entire point of using it over the in-memory dev fallback.
