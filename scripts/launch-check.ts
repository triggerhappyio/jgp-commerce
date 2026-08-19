// npm run launch:check
//
// Aggregates every non-destructive launch check into one report. Runs the
// underlying commands for real — this is not a checklist of assumptions.
// Anything that can't be verified without infrastructure this environment
// doesn't have reports BLOCKED, never a guessed PASS.
import { execSync } from "child_process";
import { appEnv } from "../lib/env";

type Result = "PASS" | "FAIL" | "BLOCKED";

function run(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkEnvVars(names: string[]): boolean {
  return names.every((n) => !!process.env[n]);
}

async function checkDb(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const results: Record<string, Result> = {};

  results["Framework"] = run("node -e \"require('next/package.json').version\"") ? "PASS" : "FAIL";
  results["Node"] = process.version.startsWith("v24") ? "PASS" : "FAIL";
  results["Dependency Audit"] = run("npm audit --production --audit-level=high") ? "PASS" : "FAIL";
  results["TypeScript"] = run("npx tsc --noEmit") ? "PASS" : "FAIL";
  results["Lint"] = run("npm run lint") ? "PASS" : "FAIL";
  results["Build"] = run("npm run build") ? "PASS" : "FAIL";

  const dbReachable = await checkDb();
  results["Environment"] = checkEnvVars(["DATABASE_URL", "AUTH_SECRET", "NEXT_PUBLIC_APP_URL"]) ? "PASS" : "BLOCKED";
  results["Database"] = process.env.DATABASE_URL ? (dbReachable ? "PASS" : "FAIL") : "BLOCKED";
  results["Migrations"] = dbReachable ? (run("npx prisma migrate status") ? "PASS" : "FAIL") : "BLOCKED";
  results["Commerce Tests"] = dbReachable ? (run("npm run test:commerce") ? "PASS" : "FAIL") : "BLOCKED";
  // No dedicated runtime auth-bypass Playwright suite exists yet (see
  // docs/PRODUCTION_CHECKLIST.md) — authorization is code-reviewed and
  // unit-testable pieces are covered, but a live bypass-attempt suite
  // against a real deployed session is still a real gap, not just an
  // infrastructure block. Reported BLOCKED either way since it can't run
  // without a database regardless.
  results["Auth Tests"] = "BLOCKED";
  results["E2E"] = process.env.STAGING_URL ? (run("npm run test:e2e") ? "PASS" : "FAIL") : "BLOCKED";

  results["Stripe Config"] = checkEnvVars(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) ? "PASS" : "BLOCKED";
  results["Redis Config"] = checkEnvVars(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) ? "PASS" : "BLOCKED";
  results["Email Config"] = checkEnvVars(["RESEND_API_KEY", "EMAIL_FROM"]) ? "PASS" : "BLOCKED";
  results["Storage Config"] = checkEnvVars(["BLOB_READ_WRITE_TOKEN"]) ? "PASS" : "BLOCKED";

  const shopifyScripts = [
    "scripts/shopify-import/import-products.ts",
    "scripts/shopify-import/import-customers.ts",
    "scripts/shopify-import/import-orders.ts",
    "scripts/shopify-import/reconcile-inventory.ts"
  ];
  results["Shopify Import Ready"] = shopifyScripts.every((f) => run(`test -f ${f}`)) ? "PASS" : "FAIL";
  results["Launch Runbook"] = run("test -f docs/LAUNCH_RUNBOOK.md") ? "PASS" : "FAIL";
  results["Rollback Runbook"] = run("grep -q 'ROLLBACK CONDITIONS' docs/LAUNCH_RUNBOOK.md") ? "PASS" : "FAIL";

  const values = Object.values(results);
  const hasFail = values.includes("FAIL");
  const hasBlocked = values.some((v) => typeof v === "string" && v.startsWith("BLOCKED"));
  const overall = hasFail ? "NOT READY (failures present)" : hasBlocked ? "NOT READY (blocked on external setup)" : "READY";

  console.log(`\nJGP PRODUCTION LAUNCH CHECK — environment: ${appEnv()}\n`);
  for (const [name, result] of Object.entries(results)) {
    console.log(`${name.padEnd(24)} ${result}`);
  }
  console.log(`\nOVERALL:\n${overall}\n`);

  if (hasFail) process.exit(1);
}

main();
