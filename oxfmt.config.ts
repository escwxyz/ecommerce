import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    "packages/db/src/migrations/**",
    "apps/start/src/routeTree.gen.ts",
    ".agents/**",
    ".claude/**",
    ".codex/*",
    "openspec/**",
  ],
});
