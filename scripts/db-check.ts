// npm run db:check
// Verifies the configured database is actually reachable, and prints
// enough context to avoid running the wrong command against the wrong
// database — without ever printing the connection string itself (which
// contains a password).
import { PrismaClient } from "@prisma/client";
import { appEnv } from "../lib/env";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  // Host only — never the credentials embedded in the URL.
  let host = "unknown";
  try {
    host = new URL(url).hostname;
  } catch {
    /* malformed URL — reported by the connection attempt below instead */
  }

  const env = appEnv();
  console.log(`\nJGP db:check — app environment: ${env}, DB host: ${host}\n`);

  if (process.env.DATABASE_ENV === "production" && env !== "production") {
    console.error(
      `DATABASE_ENV=production is set but the app environment is "${env}". ` +
        `Refusing to proceed — this looks like a production database URL in the wrong place. ` +
        `See lib/env.ts assertSafeEnvironmentCombination().`
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Reachable: yes");

    const counts = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count()
    ]).catch(() => null);

    if (counts) {
      const [products, orders, users] = counts;
      console.log(`Products: ${products}  Orders: ${orders}  Users: ${users}`);
      if (env === "production" && products === 0) {
        console.log("Note: 0 products in a production-environment database — expected only before the catalog is imported.");
      }
    } else {
      console.log("Connected, but tables don't exist yet — run db:migrate:deploy.");
    }
  } catch (err: any) {
    console.error("Reachable: no");
    console.error(String(err?.message ?? err));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
