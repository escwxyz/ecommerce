import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";
import { Schema } from "effect";

import {
  StoreApiRecordSchema,
  StoreSettingsSchema,
  UpdateStoreSettingsInputSchema,
  createStoreId,
} from "../domain";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const domainDirectory = join(currentDirectory, "..", "domain");

const readDomainSource = (fileName: string): string =>
  readFileSync(join(domainDirectory, fileName), "utf8");

describe("store Effect schemas", () => {
  it("decodes store domain settings without Zod inferred types", () => {
    const decoded = Schema.decodeUnknownSync(StoreSettingsSchema)({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      defaultCurrencyCode: "USD",
      defaultLocale: "en-US",
      defaultRegionId: null,
      defaultSalesChannelId: "sc_web",
      id: "store_effect",
      metadata: { organizationHint: "org_demo" },
      name: "Effect Store",
      supportedCurrencyCodes: ["USD", "EUR"],
      timezone: "UTC",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(decoded.id).toBe(createStoreId("store_effect"));
    expect(decoded.supportedCurrencyCodes).toEqual(["USD", "EUR"]);
    expect(decoded.metadata).toEqual({ organizationHint: "org_demo" });
  });

  it("keeps API and update schemas strict about serialized store invariants", () => {
    expect(() =>
      Schema.decodeUnknownSync(StoreApiRecordSchema)({
        createdAt: "2026-01-01T00:00:00.000Z",
        defaultCurrencyCode: "usd",
        defaultLocale: "en-US",
        defaultRegionId: null,
        defaultSalesChannelId: null,
        id: "store_api",
        metadata: {},
        name: "API Store",
        supportedCurrencyCodes: ["USD"],
        timezone: "UTC",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(UpdateStoreSettingsInputSchema)({
        supportedCurrencyCodes: [],
      })
    ).toThrow();
  });

  it("keeps Zod isolated to the temporary legacy oRPC contract bridge", () => {
    expect(readDomainSource("store.schema.ts")).not.toContain("zod");
    expect(readDomainSource("store.types.ts")).not.toContain("z.infer");
  });
});
