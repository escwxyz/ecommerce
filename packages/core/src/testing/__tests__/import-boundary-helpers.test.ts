import { describe, expect, it } from "bun:test";

import {
  createLegacyBackendImportBoundary,
  scanImportBoundaryViolations,
} from "../index";

const sourceFile = (path: string, source: string) => ({ path, source });

describe("import boundary helpers", () => {
  it("bans legacy backend imports with bounded violation details", () => {
    const boundary = createLegacyBackendImportBoundary({
      packageName: "@ecommerce/modules/store",
      rootDir: "/repo/packages/modules/store/src",
    });
    const violations = scanImportBoundaryViolations({
      boundary,
      files: [
        sourceFile(
          "/repo/packages/modules/store/src/domain/store.ts",
          [
            'import { Hono } from "hono";',
            'import type { z } from "zod";',
            'const load = () => import("@orpc/server");',
            'export type Db = import("kysely").Kysely<unknown>;',
            'import type { DurableObjectState } from "@cloudflare/workers-types";',
          ].join("\n")
        ),
      ],
    });

    expect(violations).toEqual([
      {
        filePath: "/repo/packages/modules/store/src/domain/store.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "hono",
      },
      {
        filePath: "/repo/packages/modules/store/src/domain/store.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "zod",
      },
      {
        filePath: "/repo/packages/modules/store/src/domain/store.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "@orpc/server",
      },
      {
        filePath: "/repo/packages/modules/store/src/domain/store.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "kysely",
      },
      {
        filePath: "/repo/packages/modules/store/src/domain/store.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "@cloudflare/workers-types",
      },
    ]);
  });

  it("allows package-specific extra bans and explicit exceptions", () => {
    const boundary = createLegacyBackendImportBoundary({
      allowedSpecifiers: ["zod-to-json-schema"],
      extraForbiddenSpecifiers: ["@ecommerce/db-d1"],
      packageName: "@ecommerce/modules/store",
      rootDir: "/repo/packages/modules/store/src",
    });
    const violations = scanImportBoundaryViolations({
      boundary,
      files: [
        sourceFile(
          "/repo/packages/modules/store/src/index.ts",
          [
            'import { zodToJsonSchema } from "zod-to-json-schema";',
            'import { createD1Runtime } from "@ecommerce/db-d1";',
          ].join("\n")
        ),
      ],
    });

    expect(violations).toEqual([
      {
        filePath: "/repo/packages/modules/store/src/index.ts",
        packageName: "@ecommerce/modules/store",
        ruleName: "legacy-backend-imports",
        specifier: "@ecommerce/db-d1",
      },
    ]);
  });

  it("ignores comments and ordinary strings that mention legacy packages", () => {
    const boundary = createLegacyBackendImportBoundary({
      packageName: "@ecommerce/modules/store",
      rootDir: "/repo/packages/modules/store/src",
    });
    const violations = scanImportBoundaryViolations({
      boundary,
      files: [
        sourceFile(
          "/repo/packages/modules/store/src/readme-fixture.ts",
          [
            '// import { Hono } from "hono";',
            'const note = "remove zod and kysely later";',
          ].join("\n")
        ),
      ],
    });

    expect(violations).toEqual([]);
  });
});
