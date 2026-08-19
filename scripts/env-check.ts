// npm run env:check
// Prints presence (OK/MISSING) for every env var this app reads. Never
// prints a value, secret or not — presence is all this tool asserts.
import { ENV_CONTRACT, appEnv } from "../lib/env";

const GROUPS: { label: string; vars: string[] }[] = [
  { label: "Database", vars: ["DATABASE_URL", "DIRECT_URL"] },
  { label: "Stripe", vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { label: "Redis (rate limiting)", vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] },
  { label: "Email", vars: ["RESEND_API_KEY", "EMAIL_FROM"] },
  { label: "Storage", vars: ["BLOB_READ_WRITE_TOKEN"] },
  { label: "Auth / Cron", vars: ["AUTH_SECRET", "CRON_SECRET"] },
  { label: "App", vars: ["NEXT_PUBLIC_APP_URL"] }
];

function main() {
  const env = appEnv();
  console.log(`\nJGP env:check — environment: ${env}\n`);

  let missingRequired = 0;

  for (const group of GROUPS) {
    console.log(group.label);
    for (const name of group.vars) {
      const present = !!process.env[name];
      const contract = ENV_CONTRACT[name];
      const requiredHere =
        contract?.category === "development" ||
        (contract?.category === "production" && (env === "production" || env === "preview"));

      const status = present ? "OK" : requiredHere ? "MISSING" : "missing (optional here)";
      console.log(`  ${name.padEnd(32)} ${status}`);

      if (!present && requiredHere) missingRequired++;
    }
    console.log("");
  }

  if (missingRequired > 0) {
    console.error(`${missingRequired} required variable(s) missing for the "${env}" environment. See .env.example.`);
    process.exit(1);
  }
  console.log("All variables required for this environment are present.");
}

main();
