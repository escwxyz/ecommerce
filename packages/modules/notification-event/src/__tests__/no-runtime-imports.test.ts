import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir, "..");
const importPattern =
  /(?:from\s+["']([^"']+)["'])|(?:import\s*\(\s*["']([^"']+)["']\s*\))/g;

const forbiddenImport = (specifier: string): boolean =>
  specifier === "cloudflare:workers" ||
  specifier.startsWith("hono") ||
  specifier.startsWith("@ecommerce/ui") ||
  specifier.startsWith("@ecommerce/db-d1") ||
  specifier.startsWith("@ecommerce/env/server") ||
  specifier.startsWith("@orpc/") ||
  specifier === "zod" ||
  specifier === "kysely" ||
  specifier === "kysely-d1" ||
  specifier.startsWith("../../../apps/server") ||
  specifier.startsWith("@ecommerce/server");

const forbiddenRuntimeTokenPattern =
  /\b(?:DurableObjectNamespace|DurableObjectStub|DurableObjectState)\b/;

const collectSourceFiles = (directory: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("notification event module boundaries", () => {
  it("does not import runtime-specific modules", () => {
    const violations = collectSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matched: string[] = [];

      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2];

        if (specifier && forbiddenImport(specifier)) {
          matched.push(relative(sourceRoot, filePath));
          break;
        }
      }

      if (forbiddenRuntimeTokenPattern.test(source)) {
        matched.push(relative(sourceRoot, filePath));
      }

      return matched;
    });

    expect(violations).toEqual([]);
  });
});
