import type { MetadataRoute } from "next";
import { appUrl, appEnv } from "@/lib/env";

// Explicitly environment-gated rather than assuming Vercel's platform-level
// preview protection covers every case (it covers the auto-generated
// *.vercel.app URLs, but not necessarily a stable custom staging
// subdomain some teams point at Preview) — verify:staging's noindex check
// exists specifically to prove this, not assume it.
export default function robots(): MetadataRoute.Robots {
  if (appEnv() !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/account", "/api/"]
    },
    sitemap: `${appUrl()}/sitemap.xml`
  };
}
