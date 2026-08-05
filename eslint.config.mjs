import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".open-next/**", ".sites-build/**", ".sites-output/**", ".wrangler/**", "out/**", "coverage/**", "next-env.d.ts", ".design-sync/**", ".ds-sync/**", "ds-bundle/**", "design-system/dist/**", "design_handoff_calorie_flow_mobile/**"]),
]);
