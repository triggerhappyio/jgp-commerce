import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real remote Postgres (see
    // tests/integration/helpers.ts) — vitest's 5000ms default was tripping
    // on legitimately-correct multi-step transactions against live Neon,
    // discovered running this suite for real for the first time. Unit
    // tests (tests/unit/) don't need this; it's harmless overhead for them
    // either way since they complete in milliseconds regardless.
    testTimeout: 20000
  }
});
