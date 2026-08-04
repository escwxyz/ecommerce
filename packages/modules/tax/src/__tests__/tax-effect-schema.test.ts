import { describe, expect, it } from "bun:test";

import { Schema } from "effect";

import {
  TaxCalculationResultApiSchema,
  TaxRegionApiRecordSchema,
  TaxRegionRecordSchema,
  createTaxRegionId,
} from "../domain";

describe("tax Effect schemas", () => {
  it("decodes valid domain and API tax records", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    expect(
      Schema.decodeUnknownSync(TaxRegionRecordSchema)({
        code: "US",
        countryCode: "US",
        createdAt,
        id: createTaxRegionId("txreg_schema"),
        metadata: {},
        name: "United States",
        providerConfigId: null,
        updatedAt: createdAt,
      })
    ).toMatchObject({
      id: "txreg_schema",
    });

    expect(
      Schema.decodeUnknownSync(TaxRegionApiRecordSchema)({
        code: "US",
        countryCode: "US",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "txreg_schema",
        metadata: {},
        name: "United States",
        providerConfigId: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toMatchObject({
      id: "txreg_schema",
    });

    expect(
      Schema.decodeUnknownSync(TaxCalculationResultApiSchema)({
        currencyCode: "USD",
        id: "txcalc_schema",
        lines: [],
        providerKey: "manual",
        regionId: "txreg_schema",
        totalTax: 0,
      })
    ).toMatchObject({
      id: "txcalc_schema",
    });
  });

  it("rejects invalid identifiers and non-canonical API datetimes", () => {
    expect(() =>
      Schema.decodeUnknownSync(TaxRegionApiRecordSchema)({
        code: "US",
        countryCode: "US",
        createdAt: "not-a-date",
        id: "region_schema",
        metadata: {},
        name: "United States",
        providerConfigId: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toThrow();
  });
});
