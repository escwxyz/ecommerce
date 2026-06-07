import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir);
const siblingSourceImportPattern =
  /from\s+["']\.\.\/\.\.\/[^"']*\/src\/[^"']*["']/;

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
});
