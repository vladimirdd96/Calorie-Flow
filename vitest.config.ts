import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the `@/*` path alias in tsconfig.json so modules that reach for shared
  // application code (env, Supabase client) stay testable.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts", "cloudflare/**/*.test.js", "scripts/**/*.test.mjs"] },
});
