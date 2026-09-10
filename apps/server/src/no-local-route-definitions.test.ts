import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(import.meta.dir);
const blockedPatterns = [
  /from\s+["']hono(?:\/[^"']*)?["']/,
  /new\s+Hono\b/,
  /publicProcedure/,
  /protectedProcedure/,
];

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

describe("server API boundary", () => {
  it("does not define Hono routes or business procedures locally", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const hasBlockedPattern = blockedPatterns.some((pattern) =>
        pattern.test(source)
      );

      return hasBlockedPattern ? [relative(sourceRoot, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("discovers built-in HTTP groups from the executable module composition", () => {
    const workerSource = readFileSync(join(sourceRoot, "index.ts"), "utf8");
    const compositionSource = readFileSync(
      join(sourceRoot, "production-commerce-runtime.ts"),
      "utf8"
    );

    expect(workerSource).not.toMatch(/\w+EffectHttpApiContribution/);
    expect(workerSource).not.toMatch(/contributions:\s*\[/);
    expect(workerSource).toContain("composition.apiGroups");
    expect(compositionSource).toContain("composeBuiltinCommerceApplication");
    expect(compositionSource).not.toContain("productionModuleKeys");
    expect(compositionSource).not.toContain("moduleServiceLayer");
    expect(compositionSource).not.toMatch(
      /from\s+["']@ecommerce\/[^"']+\/module["']/
    );
    expect(compositionSource).not.toMatch(
      /\bcreate[A-Z]\w*Service(?:FromDependencies)?(?:Layer)?\b/
    );
  });
});
