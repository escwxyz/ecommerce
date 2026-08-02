import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  collectImportBoundarySourceFiles,
  scanImportBoundaryViolations,
} from "@ecommerce/core/testing";

const packageRoot = join(import.meta.dir, "..", "..");
const sourceRoot = join(packageRoot, "src");
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8")
) as {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

const isTestDirectory = (path: string): boolean => path.includes("/__tests__/");

describe("api package Effect HTTP boundary", () => {
  it("does not import oRPC after backend route migration", () => {
    const violations = scanImportBoundaryViolations({
      boundary: {
        packageName: "@ecommerce/api",
        rootDir: sourceRoot,
        rules: [
          {
            forbiddenSpecifiers: ["@orpc"],
            name: "no-orpc",
          },
        ],
      },
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

  it("does not declare oRPC package dependencies", () => {
    const dependencies = {
      ...packageManifest.dependencies,
      ...packageManifest.devDependencies,
    };

    expect(Object.keys(dependencies)).not.toContainEqual(
      expect.stringMatching(/^@orpc(?:\/|$)/)
    );
  });
});
