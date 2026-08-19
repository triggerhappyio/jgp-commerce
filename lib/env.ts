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
