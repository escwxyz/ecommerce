import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const forbiddenImports = [
  "@ecommerce/db-d1",
  "@ecommerce/web",
  "@orpc/server",
  "cloudflare:workers",
  "hono",
  "kysely",
  "kysely-d1",
  "zod",
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

describe("tax module completed Effect boundary", () => {
  it("does not import legacy backend or runtime-specific modules", () => {
    const sourceRoot = new URL("../", import.meta.url).pathname;
    const files = collectFiles(sourceRoot).filter(
      (file) => !file.includes("/__tests__/")
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

  it("does not declare legacy backend dependencies or public legacy exports", () => {
    const packageJson = readFileSync(
      new URL("../../package.json", import.meta.url),
      "utf8"
    );

    for (const forbiddenDependency of [
      "@orpc/server",
      "kysely",
      "kysely-d1",
      "zod",
    ]) {
      expect(packageJson).not.toContain(`"${forbiddenDependency}"`);
    }
    expect(packageJson).not.toContain('"./adapters/d1"');
    expect(packageJson).not.toContain('"./contracts"');
    expect(packageJson).not.toContain('"./router"');
  });
});
