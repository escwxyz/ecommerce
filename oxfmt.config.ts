import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    "apps/start/src/routeTree.gen.ts",
    ".agents/**",
    ".claude/**",
    ".codex/*",
    "openspec/**",
  ],
});
