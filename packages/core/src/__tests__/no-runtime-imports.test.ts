import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  collectImportBoundarySourceFiles,
  createLegacyBackendImportBoundary,
  scanImportBoundaryViolations,
} from "../testing/index";

const sourceRoot = join(import.meta.dir, "..");
const forbiddenRuntimeTokenPattern =
  /\b(?:DurableObjectNamespace|DurableObjectStub|DurableObjectState)\b/;

const isTestFile = (path: string): boolean =>
  path.endsWith(".test.ts") || path.includes("/__tests__/");

const scanCoreImportBoundary = (rootDir: string) =>
  scanImportBoundaryViolations({
    boundary: createLegacyBackendImportBoundary({
      extraForbiddenSpecifiers: [
        "@ecommerce/db",
        "@ecommerce/db-postgres",
        "@ecommerce/platform-cloudflare",
        "@ecommerce/ui",
        "@effect/sql",
        "@effect/sql-pg",
        "drizzle-orm/d1",
        "drizzle-orm/libsql",
        "drizzle-orm/node-postgres",
        "drizzle-orm/postgres-js",
        "pg",
        "postgres",
      ],
      packageName: "@ecommerce/core",
      rootDir,
    }),
    files: collectImportBoundarySourceFiles({
      exclude: isTestFile,
      rootDir,
    }),
  }).map(
    (violation) =>
      `${relative(rootDir, violation.filePath)}: ${violation.specifier}`
  );

const scanRuntimeTokens = (rootDir: string) =>
  collectImportBoundarySourceFiles({ exclude: isTestFile, rootDir }).flatMap(
    (file) =>
      forbiddenRuntimeTokenPattern.test(readFileSync(file.path, "utf8"))
        ? [relative(rootDir, file.path)]
        : []
  );

describe("core runtime boundaries", () => {
  it("does not import legacy backend or runtime-specific modules", () => {
    expect(scanCoreImportBoundary(sourceRoot)).toEqual([]);
    expect(scanRuntimeTokens(sourceRoot)).toEqual([]);
  });

  it("keeps plugin contracts free of legacy backend or runtime-specific modules", () => {
    const pluginSourceRoot = join(sourceRoot, "plugins");

    expect(scanCoreImportBoundary(pluginSourceRoot)).toEqual([]);
    expect(scanRuntimeTokens(pluginSourceRoot)).toEqual([]);
  });
});
