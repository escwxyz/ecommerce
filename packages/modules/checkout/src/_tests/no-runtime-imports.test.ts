import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourceRoot = join(import.meta.dir, "..");
const forbiddenImports = [
  "cloudflare:workers",
  "hono",
  "kysely-d1",
  "@ecommerce/db-d1",
  "@ecommerce/platform-cloudflare",
  "@tanstack/react",
] as const;

const listTypeScriptFiles = (directory: string): readonly string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listTypeScriptFiles(path));
      continue;
    }

    if (entry.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("checkout module import boundaries", () => {
  it("does not import runtime-specific modules or private module internals", () => {
    const violations: string[] = [];

    for (const file of listTypeScriptFiles(sourceRoot)) {
      const content = readFileSync(file, "utf8");

      for (const forbiddenImport of forbiddenImports) {
        if (content.includes(`from "${forbiddenImport}`)) {
          violations.push(`${file}: ${forbiddenImport}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
