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
