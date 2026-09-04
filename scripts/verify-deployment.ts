// npm run verify:staging   (reads STAGING_URL)
// npm run verify:production (reads PRODUCTION_URL)
//
// Read-only HTTP smoke test against an already-deployed environment. Never
// creates data, never places an order, never sends email — this proves
// "the deployment is up and serving the right thing," not commerce
// correctness (that's tests/integration/*, run against the database
// directly, and the deliberate manual live-order procedure in
// docs/LAUNCH_RUNBOOK.md).
const mode = process.argv[2]; // "staging" | "production"
const url = mode === "production" ? process.env.PRODUCTION_URL : process.env.STAGING_URL;

if (!mode || !["staging", "production"].includes(mode)) {
  console.error("Usage: tsx scripts/verify-deployment.ts <staging|production>");
  process.exit(1);
}
if (!url) {
  console.error(`${mode === "production" ? "PRODUCTION_URL" : "STAGING_URL"} is not set.`);
  console.error(`Usage: ${mode === "production" ? "PRODUCTION_URL" : "STAGING_URL"}=https://... npm run verify:${mode}`);
  process.exit(1);
}

type Check = { name: string; run: () => Promise<{ ok: boolean; detail: string }> };

// Vercel's "Deployment Protection" (auto-enabled SSO gate on Preview
// deployments) intercepts every request at the platform level with a 302
// to a vercel.com auth page — indistinguishable from a real app failure
// by status code alone unless you know to look at the Location header.
// Detected here so a protected deployment reports one clear message
// instead of every single check failing with a confusing 302.
const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

async function fetchStatus(path: string): Promise<{ status: number; text: string; headers: Headers; protected: boolean }> {
  const target = new URL(path, url);
  if (bypassToken) target.searchParams.set("x-vercel-protection-bypass", bypassToken);
  const res = await fetch(target, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const isProtectionRedirect = res.status >= 300 && res.status < 400 && /vercel\.com\/(sso-)?api|\/api\/vercel-sso/.test(location);
  const text = isProtectionRedirect ? "" : await res.text().catch(() => "");
  return { status: res.status, text, headers: res.headers, protected: isProtectionRedirect };
}

const commonChecks: Check[] = [
  {
    name: "Homepage",
    run: async () => {
      const { status } = await fetchStatus("/");
      return { ok: status === 200, detail: `HTTP ${status}` };
    }
  },
  {
    name: "Catalog (/shop)",
    run: async () => {
      const { status } = await fetchStatus("/shop");
      return { ok: status === 200, detail: `HTTP ${status}` };
    }
  },
  {
    name: "Login page",
    run: async () => {
      const { status } = await fetchStatus("/account/login");
      return { ok: status === 200, detail: `HTTP ${status}` };
    }
  },
  {
    name: "Registration page",
    run: async () => {
      const { status } = await fetchStatus("/account/register");
      return { ok: status === 200, detail: `HTTP ${status}` };
    }
  },
  {
    name: "Health endpoint",
    run: async () => {
      const { status, text } = await fetchStatus("/api/health");
      const ok = status === 200 && text.includes('"status"');
      return { ok, detail: `HTTP ${status}` };
    }
  },
  {
    name: "robots.txt",
    run: async () => {
      const { status, text } = await fetchStatus("/robots.txt");
      const disallowsAll = /Disallow:\s*\/\s*$/m.test(text.trim()) && !text.includes("Allow: /");
      if (mode === "staging") {
        return { ok: status === 200 && disallowsAll, detail: disallowsAll ? "correctly disallows all" : "NOT noindexed — check appEnv()" };
      }
      return { ok: status === 200 && !disallowsAll, detail: disallowsAll ? "unexpectedly disallowing everything in production" : "allows indexing" };
    }
  },
  {
    name: "Admin — unauthenticated request denied",
    run: async () => {
      const { status } = await fetchStatus("/admin");
      // Expect a redirect (to /admin/login) — never a 200 with real content.
      const ok = status >= 300 && status < 400;
      return { ok, detail: `HTTP ${status} (expected a 3xx redirect, never 200)` };
    }
  }
];

const productionOnlyChecks: Check[] = [
  {
    name: "sitemap.xml",
    run: async () => {
      const { status } = await fetchStatus("/sitemap.xml");
      return { ok: status === 200, detail: `HTTP ${status}` };
    }
  },
  {
    name: "Alias redirect (jgpusa.store equivalents)",
    run: async () => {
      return { ok: true, detail: "SKIPPED — requires DNS for the alias domains to be live; verify manually per docs/SHOPIFY_MIGRATION.md" };
    }
  }
];

async function main() {
  console.log(`\nVerifying ${mode} deployment: ${url}\n`);

  const probe = await fetchStatus("/");
  if (probe.protected && !bypassToken) {
    console.error(
      "This deployment is behind Vercel Deployment Protection (SSO gate on Preview deployments by default).\n" +
        "Every check below would fail with a confusing 302, not because the app is broken.\n\n" +
        "Fix: Project Settings -> Deployment Protection -> \"Protection Bypass for Automation\" -> generate a secret,\n" +
        "then re-run with:\n" +
        `  VERCEL_AUTOMATION_BYPASS_SECRET=<secret> STAGING_URL=${url} npm run verify:${mode}\n`
    );
    process.exit(1);
  }

  const checks = mode === "production" ? [...commonChecks, ...productionOnlyChecks] : commonChecks;

  let failures = 0;
  for (const check of checks) {
    try {
      const { ok, detail } = await check.run();
      console.log(`${ok ? "PASS" : "FAIL"}  ${check.name.padEnd(40)} ${detail}`);
      if (!ok) failures++;
    } catch (err: any) {
      console.log(`FAIL  ${check.name.padEnd(40)} ${String(err?.message ?? err)}`);
      failures++;
    }
  }

  console.log(`\n${checks.length - failures}/${checks.length} checks passed.`);
  if (failures > 0) process.exit(1);
}

main();
