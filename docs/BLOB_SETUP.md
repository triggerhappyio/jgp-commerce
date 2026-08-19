# Vercel Blob (Object Storage) Setup

1. In the Vercel project → **Storage** tab → **Create Database** → **Blob**.
2. This auto-provisions `BLOB_READ_WRITE_TOKEN` into the project's
   environment variables for you (all scopes) — no manual copy/paste
   needed for Vercel-hosted environments.
3. For local dev, copy the token from Vercel (Storage → your Blob store →
   `.env.local` tab, which shows the exact line to paste) into your local
   `.env.local`.
4. Redeploy if the Blob store was created after the last deploy.

## What this enables

Admin product-image upload (`/admin/products/[id]` → Images section,
backed by `app/api/admin/upload-image` and `lib/storage.ts`). Validates
file type (JPEG/PNG/WebP), size (5MB max), and staff authentication
server-side — never trust a client-supplied URL as a substitute for a real
upload.

## Test it worked

1. Log in to `/admin` as STAFF or higher.
2. Open any product → Images → choose a real JPEG/PNG file.
3. Confirm the thumbnail appears after upload and the image renders on the
   live product page (`/shop/<slug>`).
4. Try removing it — confirm it disappears from both the admin list and
   the storefront.

### Authorization check (do this too, not just the happy path)

- Log out, `curl -X POST` (or similar) directly to
  `/api/admin/upload-image` with a file attached, no session cookie —
  expect `401 Unauthorized`.
- Log in as a CUSTOMER-role account, repeat — expect `401 Unauthorized`
  (role check, not just "logged in").
