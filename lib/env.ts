// Centralized environment validation. Import `requireEnv` (or the
// individual getters) instead of reading `process.env.X` inline — one
// place to see what's actually required, and production fails loudly at
// the point of use rather than deep inside a Stripe/Prisma call with a
// confusing error.
//
// Deliberately NOT validated eagerly at module load / process start: this
// app runs plenty of routes (marketing pages, /the-truth, /contact) that
// need none of these, and Next.js loads this module in contexts (edge
// middleware, build-time static analysis) where throwing on import would
// break things that have nothing to do with the missing var. Each secret
// is validated only by the code path that actually needs it.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

export function requireDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}

export function requireStripeSecretKey(): string {
  return requireEnv("STRIPE_SECRET_KEY");
}

export function requireStripeWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function requireAuthSecret(): string {
  return requireEnv("AUTH_SECRET");
}

export function requireCronSecret(): string {
  return requireEnv("CRON_SECRET");
}

// True public config is fine as NEXT_PUBLIC_* — the app has exactly one
// today. Anything secret (API keys, DB URLs, webhook secrets) must NEVER
// get that prefix, since Next.js inlines NEXT_PUBLIC_* values into the
// client JS bundle at build time.
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ─────────────────────────────────────────────────────────────────────────
// Environment mode — NODE_ENV alone isn't enough: Vercel Preview
// deployments also run with NODE_ENV=production, so "is this really
// production" and "is this a production build" are different questions.
// VERCEL_ENV (set automatically by Vercel: "production" | "preview" |
// "development") is authoritative when present; APP_ENV is the manual
// fallback for non-Vercel environments (local dev, CI).
// ─────────────────────────────────────────────────────────────────────────
export type AppEnv = "development" | "preview" | "production";

export function appEnv(): AppEnv {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  const manual = process.env.APP_ENV;
  if (manual === "production" || manual === "preview" || manual === "development") {
    return manual;
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export class UnsafeEnvironmentError extends Error {}

/**
 * Fails fast on dangerous environment/secret combinations that a plain
 * "is this var present" check can't catch — a present-but-wrong secret is
 * worse than a missing one. Call at the top of the checkout route (the
 * one place a wrong Stripe key would actually move real or fake money).
 */
export function assertSafeEnvironmentCombination(): void {
  const env = appEnv();
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (stripeKey) {
    const isLiveKey = stripeKey.startsWith("sk_live_");
    const isTestKey = stripeKey.startsWith("sk_test_");
    if (env !== "production" && isLiveKey) {
      throw new UnsafeEnvironmentError(
        `Refusing to start: a Stripe LIVE key is set in a "${env}" environment. This would take real payments from a non-production deployment.`
      );
    }
    if (env === "production" && isTestKey) {
      throw new UnsafeEnvironmentError(
        `Refusing to start: a Stripe TEST key is set in the production environment. Production must use a live key — a test key here would silently fail to take real payments.`
      );
    }
  }

  // Opt-in extra guard: operators can tag a database connection string's
  // environment as a comment-style suffix or set this alongside
  // DATABASE_URL if they want a hard stop against ever pointing a
  // non-production deployment at the production database. Not required —
  // absence of this var is not itself an error — but if present and it
  // says "production" while we're not actually in production, that's
  // exactly the dangerous combination Phase 2 asks to catch.
  if (process.env.DATABASE_ENV === "production" && env !== "production") {
    throw new UnsafeEnvironmentError(
      `Refusing to start: DATABASE_ENV=production is set in a "${env}" environment. This looks like the production database URL was pasted into the wrong place.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Environment variable contract — every variable this app reads,
// categorized. Kept as data (not just comments) so it can be asserted
// against in a CI step later if useful; today it's the authoritative
// reference docs/PRODUCTION_CHECKLIST.md and .env.example both point back to.
// ─────────────────────────────────────────────────────────────────────────
type EnvCategory = "development" | "preview" | "production" | "optional";

export const ENV_CONTRACT: Record<string, { category: EnvCategory; secret: boolean; note: string }> = {
  DATABASE_URL: { category: "development", secret: true, note: "Postgres, pooled connection" },
  DIRECT_URL: { category: "development", secret: true, note: "Postgres, direct connection (prisma migrate)" },
  AUTH_SECRET: { category: "development", secret: true, note: "Signs session JWTs" },
  STRIPE_SECRET_KEY: { category: "development", secret: true, note: "Test key in dev/preview, live key only in production" },
  STRIPE_WEBHOOK_SECRET: { category: "development", secret: true, note: "Per-environment — test and live webhooks have separate secrets" },
  CRON_SECRET: { category: "production", secret: true, note: "Protects /api/cron/release-reservations" },
  NEXT_PUBLIC_APP_URL: { category: "development", secret: false, note: "Genuinely public — the app's own origin" },
  STRIPE_AUTOMATIC_TAX_ENABLED: { category: "optional", secret: false, note: "Defaults off — see docs/TAX_SETUP.md" },
  SHIPPING_ENABLED: { category: "optional", secret: false, note: "Defaults true" },
  SHIPPING_STANDARD_AMOUNT_CENTS: { category: "optional", secret: false, note: "Defaults to a placeholder — set the real rate before launch" },
  SHIPPING_FREE_THRESHOLD_CENTS: { category: "optional", secret: false, note: "Defaults to a placeholder — set the real threshold before launch" },
  UPSTASH_REDIS_REST_URL: { category: "production", secret: true, note: "Required in production — see lib/rate-limit.ts" },
  UPSTASH_REDIS_REST_TOKEN: { category: "production", secret: true, note: "Required in production — see lib/rate-limit.ts" },
  RESEND_API_KEY: { category: "production", secret: true, note: "Required in production for emails to actually send" },
  EMAIL_FROM: { category: "production", secret: false, note: "Verified sender address/domain in Resend" },
  BLOB_READ_WRITE_TOKEN: { category: "production", secret: true, note: "Required in production for admin image upload" }
};
