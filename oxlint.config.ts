import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: core.ignorePatterns
    ? [
        ...core.ignorePatterns,
        "packages/db/src/schema/auth-schema.ts",
        "packages/env/env.d.ts",
        "apps/start/src/routeTree.gen.ts",
        ".agents/**",
        ".claude/**",
        "*.test.ts",
      ]
    : [],
  rules: {
    "eslint/func-style": "off",
    "eslint/no-inline-comments": "warn",
    "eslint/no-use-before-define": "off",
    "eslint/no-warning-comments": "warn",
    "import/no-relative-parent-imports": "off",
    "sort-keys": "off",
    "unicorn/filename-case": "off",
    "unicorn/prefer-module": "off",
  },
});
