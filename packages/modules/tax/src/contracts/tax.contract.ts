import { defineApiContractRoute } from "@ecommerce/module-contracts";

import {
  CalculateTaxInputSchema,
  CreateTaxCategoryInputSchema,
  CreateTaxProviderConfigInputSchema,
  CreateTaxRateInputSchema,
  CreateTaxRegionInputSchema,
  TaxCalculationResultSchema,
  TaxCategoryApiRecordSchema,
  TaxProviderConfigApiRecordSchema,
  TaxRateApiRecordSchema,
  TaxRegionApiRecordSchema,
} from "../domain";

export const taxContractRouter = {
  taxCalculate: defineApiContractRoute({
    description:
      "Calculate tax lines from address, region, item, adjustment, and policy inputs.",
    method: "POST",
    operationId: "taxCalculate",
    path: "/tax/calculate",
    successDescription: "Tax lines returned.",
    summary: "Calculate tax",
    tags: ["Tax"],
  })
    .input(CalculateTaxInputSchema)
    .output(TaxCalculationResultSchema),
  taxCategoryCreate: defineApiContractRoute({
    description: "Create a tax-owned category used to select applicable rates.",
    method: "POST",
    operationId: "taxCategoryCreate",
    path: "/tax/categories",
    successDescription: "Tax category created.",
    summary: "Create tax category",
    tags: ["Tax"],
  })
    .input(CreateTaxCategoryInputSchema)
    .output(TaxCategoryApiRecordSchema),
  taxProviderConfigCreate: defineApiContractRoute({
    description:
      "Create tax provider configuration behind the provider contract.",
    method: "POST",
    operationId: "taxProviderConfigCreate",
    path: "/tax/provider-configs",
    successDescription: "Tax provider configuration created.",
    summary: "Create tax provider configuration",
    tags: ["Tax"],
  })
    .input(CreateTaxProviderConfigInputSchema)
    .output(TaxProviderConfigApiRecordSchema),
  taxRateCreate: defineApiContractRoute({
    description:
      "Create a tax-owned rate for a tax region and optional category.",
    method: "POST",
    operationId: "taxRateCreate",
    path: "/tax/rates",
    successDescription: "Tax rate created.",
    summary: "Create tax rate",
    tags: ["Tax"],
  })
    .input(CreateTaxRateInputSchema)
    .output(TaxRateApiRecordSchema),
  taxRegionCreate: defineApiContractRoute({
    description:
      "Create tax-owned regional configuration without owning market policy.",
    method: "POST",
    operationId: "taxRegionCreate",
    path: "/tax/regions",
    successDescription: "Tax region created.",
    summary: "Create tax region",
    tags: ["Tax"],
  })
    .input(CreateTaxRegionInputSchema)
    .output(TaxRegionApiRecordSchema),
} as const;
