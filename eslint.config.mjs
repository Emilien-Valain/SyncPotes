import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.5 still ships only eslintrc-style configs, so we bridge
// it into ESLint 9's flat config. Replace this with a direct import if/when the
// package exports a flat entry point.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      // Deliberate rule violations for Semgrep; not app code. See their README.
      "docs/semgrep-canaries/**",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
];
