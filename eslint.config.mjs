import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "invoice-management/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "data/**",
    "uploads/**",
    "next-env.d.ts",
    "*.log",
  ]),
]);

export default eslintConfig;
