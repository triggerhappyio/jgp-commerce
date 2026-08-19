/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.jgpusa.com" },
      // Vercel Blob (real uploaded product images, see lib/storage.ts)
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Shopify CDN — interim/migration period only, see docs/SHOPIFY_MIGRATION.md
      { protocol: "https", hostname: "cdn.shopify.com" }
    ]
  }
};

module.exports = nextConfig;
