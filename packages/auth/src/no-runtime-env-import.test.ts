import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir);
const blockedImportPattern = /@ecommerce\/env\/server/;

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

describe("shared auth boundary", () => {
  it("does not import the server runtime environment", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return blockedImportPattern.test(source)
        ? [relative(sourceRoot, filePath)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
