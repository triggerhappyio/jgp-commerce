import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/env";
import { ProductStatus } from "@prisma/client";

export const revalidate = 3600; // catalog changes don't need sub-hour freshness in the sitemap

const STATIC_PAGES = [
  "",
  "/shop",
  "/the-truth",
  "/the-difference",
  "/the-science",
  "/reviews",
  "/contact",
  "/consultation"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/shop" ? "daily" : "monthly"
  }));

  // Best-effort: if the database isn't reachable (e.g. this ran during a
  // build/environment with no DATABASE_URL), still return the static
  // pages rather than failing the whole sitemap.
  try {
    const products = await prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { slug: true, updatedAt: true }
    });
    const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly"
    }));
    return [...staticEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
