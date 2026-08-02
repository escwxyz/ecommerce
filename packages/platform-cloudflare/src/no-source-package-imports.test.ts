import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { extractImportSpecifiers } from "@ecommerce/core";

const sourceRoot = join(import.meta.dir);
const siblingSourceImportPattern =
  /from\s+["']\.\.\/\.\.\/[^"']*\/src\/[^"']*["']/;
const sandboxAdapterFile = join(sourceRoot, "sandbox.ts");
const sandboxForbiddenHostResourceImports = [
  "@cloudflare/workers-types",
  "@ecommerce/db",
  "@ecommerce/db-d1",
  "@ecommerce/db-postgres",
  "@ecommerce/infra",
  "@effect/sql",
  "@effect/sql-pg",
  "cloudflare:workers",
  "drizzle-orm",
  "pg",
  "postgres",
] as const;
const sandboxForbiddenHostResourcePatterns = [
  /\bDATABASE_URL\b/u,
  /\bDurableObjectNamespace\b/u,
  /\bPOSTGRES_URL\b/u,
  /\bRedacted\.value\b/u,
] as const;

const listSourceFiles = (directory: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("cloudflare platform package boundaries", () => {
  it("imports workspace packages through public package exports", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return siblingSourceImportPattern.test(source)
        ? [relative(sourceRoot, filePath)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps the sandbox adapter from importing raw host resources", () => {
    const source = readFileSync(sandboxAdapterFile, "utf8");
    const importViolations = extractImportSpecifiers(source).filter(
      (specifier) =>
        sandboxForbiddenHostResourceImports.some(
          (forbidden) =>
            specifier === forbidden || specifier.startsWith(`${forbidden}/`)
        )
    );
    const sourceViolations = sandboxForbiddenHostResourcePatterns.flatMap(
      (pattern) => (pattern.test(source) ? [String(pattern)] : [])
    );

    expect(importViolations).toEqual([]);
    expect(sourceViolations).toEqual([]);
  });
});
