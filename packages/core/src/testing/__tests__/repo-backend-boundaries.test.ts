import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  extractImportSpecifiers,
  scanImportBoundaryViolations,
} from "../index";

const repoRoot = join(import.meta.dir, "../../../../..");

const legacyBackendSpecifiers = [
  "@ecommerce/db",
  "@ecommerce/db-d1",
  "@ecommerce/db-utils",
  "@orpc",
  "hono",
  "kysely",
  "kysely-d1",
  "zod",
] as const;

const runtimeNeutralCloudflareSpecifiers = [
  "@cloudflare/workers-types",
  "@ecommerce/platform-cloudflare",
  "cloudflare:workers",
] as const;

const serverOnlyStorefrontSdkSpecifier = "@ecommerce/storefront-sdk/cloudflare";

const productionSourcePattern = /\.(?:ts|tsx|mts|cts)$/u;
const packageManifestPattern = /(?:^|\/)package\.json$/u;
const testPathPattern = /(?:^|\/)(?:__tests__\/|[^/]+\.(?:test|spec)\.)/u;

const trackedFiles = (patterns: readonly string[]): readonly string[] => {
  const result = spawnSync("git", ["ls-files", ...patterns], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed");
  }

  return result.stdout
    .split("\n")
    .filter(Boolean)
    .filter((path) => existsSync(join(repoRoot, path)));
};

const isBackendProductionSource = (path: string): boolean =>
  productionSourcePattern.test(path) &&
  !testPathPattern.test(path) &&
  (path.startsWith("apps/server/src/") ||
    (path.startsWith("packages/") &&
      !path.startsWith("packages/env/") &&
      !path.startsWith("packages/ui/")));

const isRuntimeNeutralProductionSource = (path: string): boolean =>
  productionSourcePattern.test(path) &&
  !testPathPattern.test(path) &&
  (path.startsWith("packages/api/src/") ||
    path.startsWith("packages/auth/src/") ||
    path.startsWith("packages/core/src/") ||
    path.startsWith("packages/db-postgres/src/") ||
    path.startsWith("packages/modules/") ||
    path.startsWith("packages/payment-provider/src/") ||
    path.startsWith("packages/storefront-sdk/src/"));

const isServerOnlyStorefrontSdkEntry = (path: string): boolean =>
  path === "packages/storefront-sdk/src/cloudflare.ts";

const isServerRuntimeSource = (path: string): boolean =>
  path.startsWith("apps/server/src/") ||
  path.startsWith("packages/infra/") ||
  path.startsWith("packages/platform-cloudflare/src/");

const packageNameForManifest = (path: string): string => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as {
    readonly name?: string;
  };

  return manifest.name ?? path.replace(/\/package\.json$/u, "");
};

const dependencyNames = (path: string): readonly string[] => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly optionalDependencies?: Record<string, string>;
    readonly peerDependencies?: Record<string, string>;
  };

  return Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  });
};

const matchesSpecifier = (specifier: string, candidate: string): boolean =>
  specifier === candidate || specifier.startsWith(`${candidate}/`);

const hasForbiddenSpecifier = (
  specifier: string,
  forbiddenSpecifiers: readonly string[]
): boolean =>
  forbiddenSpecifiers.some((candidate) =>
    matchesSpecifier(specifier, candidate)
  );

describe("repository backend boundary gates", () => {
  it("rejects legacy backend framework, schema, router, and database imports across production backend source", () => {
    const files = trackedFiles(["apps", "packages"])
      .filter(isBackendProductionSource)
      .map((path) => ({
        path: join(repoRoot, path),
        source: readFileSync(join(repoRoot, path), "utf8"),
      }));

    const violations = scanImportBoundaryViolations({
      boundary: {
        packageName: "repo-backend",
        rootDir: repoRoot,
        rules: [
          {
            forbiddenSpecifiers: legacyBackendSpecifiers,
            name: "repo-legacy-backend-imports",
          },
        ],
      },
      files,
    }).map((violation) => ({
      ...violation,
      filePath: relative(repoRoot, violation.filePath),
    }));

    expect(violations).toEqual([]);
  });

  it("rejects legacy backend dependencies from tracked backend package manifests", () => {
    const manifests = trackedFiles([
      "apps/**/package.json",
      "packages/**/package.json",
    ])
      .filter(
        (path) =>
          packageManifestPattern.test(path) &&
          (path.startsWith("apps/server/") ||
            (path.startsWith("packages/") &&
              !path.startsWith("packages/env/") &&
              !path.startsWith("packages/ui/")))
      )
      .map((path) => ({
        packageName: packageNameForManifest(path),
        path,
      }));

    const violations = manifests.flatMap(({ packageName, path }) =>
      dependencyNames(path)
        .filter((dependency) =>
          hasForbiddenSpecifier(dependency, legacyBackendSpecifiers)
        )
        .map((dependency) => ({ dependency, packageName, path }))
    );

    expect(violations).toEqual([]);
  });

  it("keeps Cloudflare runtime imports out of runtime-neutral production packages", () => {
    const files = trackedFiles(["packages"])
      .filter(isRuntimeNeutralProductionSource)
      .filter((path) => !isServerOnlyStorefrontSdkEntry(path))
      .map((path) => ({
        path: join(repoRoot, path),
        source: readFileSync(join(repoRoot, path), "utf8"),
      }));

    const violations = scanImportBoundaryViolations({
      boundary: {
        packageName: "repo-runtime-neutral",
        rootDir: repoRoot,
        rules: [
          {
            forbiddenSpecifiers: runtimeNeutralCloudflareSpecifiers,
            name: "repo-runtime-neutral-cloudflare-imports",
          },
        ],
      },
      files,
    }).map((violation) => ({
      ...violation,
      filePath: relative(repoRoot, violation.filePath),
    }));

    expect(violations).toEqual([]);
  });

  it("keeps the server-only storefront SDK transport out of browser and runtime-neutral source", () => {
    const violations = trackedFiles(["apps", "packages"])
      .filter(productionSourcePattern.test.bind(productionSourcePattern))
      .filter((path) => !testPathPattern.test(path))
      .filter((path) => !isServerOnlyStorefrontSdkEntry(path))
      .filter((path) => !isServerRuntimeSource(path))
      .flatMap((path) => {
        const source = readFileSync(join(repoRoot, path), "utf8");

        return extractImportSpecifiers(source)
          .filter((specifier) =>
            matchesSpecifier(specifier, serverOnlyStorefrontSdkSpecifier)
          )
          .map((specifier) => ({ path, specifier }));
      });

    expect(violations).toEqual([]);
  });
});
