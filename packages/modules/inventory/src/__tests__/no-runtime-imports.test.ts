import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  collectImportBoundarySourceFiles,
  createLegacyBackendImportBoundary,
  scanImportBoundaryViolations,
} from "@ecommerce/core/testing";

const packageRoot = join(import.meta.dir, "..", "..");
const sourceRoot = join(packageRoot, "src");
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8")
) as {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
};
const legacyPackageNames = [
  "@orpc/server",
  "kysely",
  "kysely-d1",
  "zod",
] as const;

const isTestDirectory = (path: string): boolean =>
  path.includes("/__tests__/") || path.includes("/_tests/");

describe("inventory module completed Effect boundary", () => {
  it("does not import legacy backend or runtime-specific modules", () => {
    const boundary = createLegacyBackendImportBoundary({
      extraForbiddenSpecifiers: ["@ecommerce/db-d1"],
      packageName: "@ecommerce/inventory",
      rootDir: sourceRoot,
    });
    const violations = scanImportBoundaryViolations({
      boundary,
      files: collectImportBoundarySourceFiles({
        exclude: isTestDirectory,
        rootDir: sourceRoot,
      }),
    }).map((violation) => ({
      ...violation,
      filePath: relative(sourceRoot, violation.filePath),
    }));

    expect(violations).toEqual([]);
  });

  it("does not declare legacy backend dependencies or public legacy exports", () => {
    const dependencies = {
      ...packageManifest.dependencies,
      ...packageManifest.devDependencies,
    };

    for (const packageName of legacyPackageNames) {
      expect(dependencies).not.toHaveProperty(packageName);
    }

    expect(packageManifest.exports).not.toHaveProperty("./adapters/d1");
    expect(packageManifest.exports).not.toHaveProperty("./contracts");
    expect(packageManifest.exports).not.toHaveProperty("./router");
  });
});
