import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir);
const importPattern =
  /(?:from\s+["']([^"']+)["'])|(?:import\s*\(\s*["']([^"']+)["']\s*\))/g;

const forbiddenImport = (specifier: string): boolean =>
  specifier === "cloudflare:workers" ||
  specifier.startsWith("hono") ||
  specifier.startsWith("paykit") ||
  specifier.startsWith("paykitjs") ||
  specifier.startsWith("@getpaykit") ||
  specifier.startsWith("stripe") ||
  specifier.startsWith("@stripe/");

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

describe("payment provider package boundary", () => {
  it("does not import concrete payment SDKs or runtime bindings", () => {
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

      return matched;
    });

    expect(violations).toEqual([]);
  });
});
