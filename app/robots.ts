import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

// Same file serves every environment (dev/preview/production) since
// Vercel Preview deployments are typically already excluded from search
// engines at the platform level (x-robots-tag on preview domains) — this
// only needs to keep genuinely private/staff-only paths out of the index
// on the real production domain.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/account", "/api/"]
    },
    sitemap: `${appUrl()}/sitemap.xml`
  };
}
