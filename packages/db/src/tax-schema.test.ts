import { describe, expect, it } from "bun:test";

import {
  commerceMigrations,
  type CommerceDatabaseSchemaKey,
  taxSchema,
} from ".";

describe("tax schema assembly", () => {
  it("contributes tax-owned tables to the shared database contract", () => {
    const schemaKeys = [
      "tax_category",
      "tax_provider_config",
      "tax_region",
      "tax_rate",
      "tax_calculation_policy",
    ] satisfies CommerceDatabaseSchemaKey[];

    expect(schemaKeys).toEqual([
      taxSchema.taxCategoryTableName,
      taxSchema.taxProviderConfigTableName,
      taxSchema.taxRegionTableName,
      taxSchema.taxRateTableName,
      taxSchema.taxCalculationPolicyTableName,
    ]);
    expect(Object.keys(commerceMigrations)).toContain("008_tax");
  });
});
