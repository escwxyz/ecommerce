import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const forbiddenImports = [
  "@ecommerce/db-d1",
  "@ecommerce/web",
  "cloudflare:workers",
  "hono",
  "kysely-d1",
] as const;

const collectFiles = (directory: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }

    if (path.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("promotion module import boundaries", () => {
  it("does not import runtime-specific packages or concrete database adapters", () => {
    const sourceRoot = new URL("../", import.meta.url).pathname;
    const files = collectFiles(sourceRoot).filter(
      (file) => !file.includes("/_tests/")
    );
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      for (const forbiddenImport of forbiddenImports) {
        if (source.includes(`"${forbiddenImport}"`)) {
          violations.push(`${file}: ${forbiddenImport}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
