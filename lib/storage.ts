// Object storage — Vercel Blob, behind a thin abstraction so callers never
// touch the @vercel/blob SDK directly. If a different provider is ever
// needed (S3-compatible, etc.), only this file changes.
import { put, del } from "@vercel/blob";
import { appEnv } from "@/lib/env";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export class StorageError extends Error {}

// Keyed on appEnv() rather than raw NODE_ENV — see lib/rate-limit.ts for
// why (Vercel sets NODE_ENV=production on every deployed build, Preview
// included, so a raw NODE_ENV check would also hard-fail a staging/demo
// deployment that never claimed to have Blob configured).
export function assertStorageConfigured(): void {
  if (appEnv() === "production" && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageError("Object storage is not configured for production: set BLOB_READ_WRITE_TOKEN (Vercel Blob).");
  }
}

function assertValidImage(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new StorageError(`Unsupported file type "${file.type}" — only JPEG, PNG, or WebP are allowed.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new StorageError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max is 5MB.`);
  }
  if (file.size === 0) {
    throw new StorageError("File is empty.");
  }
}

/**
 * Uploads a validated product image. `keyPrefix` scopes the generated
 * object key (e.g. a product id) so keys are predictable and collisions
 * across products are impossible without staff needing to think about
 * naming. Vercel Blob itself adds a random suffix on top for cache-busting
 * and to prevent overwriting a previous upload of the same name.
 */
export async function uploadProductImage(file: File, keyPrefix: string): Promise<{ url: string }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageError("Object storage is not configured — set BLOB_READ_WRITE_TOKEN.");
  }
  assertValidImage(file);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9-]/g, "");
  const key = `products/${safePrefix}/${Date.now()}.${ext}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return { url: blob.url };
}

export async function deleteProductImage(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    // Non-fatal — an orphaned blob costs a few cents of storage, not
    // correctness. Log it so it can be cleaned up, don't fail the caller's
    // (usually more important) database update over it.
    console.error(`[storage] Failed to delete blob ${url}:`, err);
  }
}
