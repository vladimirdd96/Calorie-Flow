import { build } from "esbuild";

// The real app's env module reads process.env at import time — Next.js
// inlines those via its own bundler define, but this package is re-bundled
// by the design-sync converter's plain esbuild, which has no `process`
// global. Replacing the whole `process.env` expression here (rather than
// enumerating each key) keeps this in sync as the app adds env vars.
await build({
  entryPoints: ["entry.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/design-system/entry.js",
  packages: "external",
  jsx: "automatic",
  define: { "process.env": "{}" },
  allowOverwrite: true,
});
