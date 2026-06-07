import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir);
const importPattern =
  /(?:from\s+["']([^"']+)["'])|(?:import\s*\(\s*["']([^"']+)["']\s*\))/g;

const forbiddenImport = (specifier: string): boolean =>
  specifier === "cloudflare:workers" ||
  specifier.startsWith("hono") ||
  specifier.startsWith("@ecommerce/ui") ||
  specifier.startsWith("@ecommerce/db") ||
  specifier.startsWith("@ecommerce/platform-cloudflare") ||
  specifier.startsWith("kysely-d1") ||
  specifier.startsWith("drizzle-orm/d1") ||
  specifier.startsWith("drizzle-orm/libsql") ||
  specifier.startsWith("drizzle-orm/node-postgres") ||
  specifier.startsWith("drizzle-orm/postgres-js");

const forbiddenRuntimeTokenPattern =
  /\b(?:DurableObjectNamespace|DurableObjectStub|DurableObjectState)\b/;

const listSourceFiles = (directory: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(path);
    }
  }

  return files;
};

describe("core runtime boundaries", () => {
  it("does not import runtime-specific modules", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((filePath) => {
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

  it("keeps plugin contracts free of runtime-specific modules", () => {
    const pluginSourceRoot = join(sourceRoot, "plugins");
    const violations = listSourceFiles(pluginSourceRoot).flatMap((filePath) => {
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
