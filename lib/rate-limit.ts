// Minimal rate-limit abstraction for abuse-sensitive endpoints
// (registration, checkout creation). This implementation is in-memory and
// per-process — it works for local dev and a single long-running server,
// but Vercel serverless functions are NOT guaranteed to reuse the same
// process between requests, so in production this degrades to "no
// meaningful rate limiting" rather than silently failing insecurely open
// or closed. That's an explicit, documented limitation, not a bug nobody
// noticed.
//
// PRODUCTION: replace `checkRateLimit` below with a real distributed
// limiter — Upstash Redis + `@upstash/ratelimit` is the standard fit for
// Vercel (works from Edge and Node runtimes, no server to run yourself).
// Everything that calls `checkRateLimit()` only needs `{ allowed: boolean }`
// back, so swapping the implementation doesn't touch any call site.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function clientKeyFrom(req: Request, scope: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `${scope}:${ip}`;
}
