import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CalculateTaxInputSchema,
  CreateTaxCategoryInputSchema,
  CreateTaxProviderConfigInputSchema,
  CreateTaxRateInputSchema,
  CreateTaxRegionInputSchema,
  TaxCalculationPolicySchema,
  TaxCalculationResultSchema,
  TaxCategoryApiRecordSchema,
  TaxCategoryRecordSchema,
  TaxLineSchema,
  TaxProviderConfigApiRecordSchema,
  TaxProviderConfigRecordSchema,
  TaxRateApiRecordSchema,
  TaxRateRecordSchema,
  TaxRegionApiRecordSchema,
  TaxRegionRecordSchema,
} from "./tax.schema";

export type TaxRegionId = Brand<string, "tax-region">;
export type TaxRateId = Brand<string, "tax-rate">;
export type TaxCategoryId = Brand<string, "tax-category">;
export type TaxProviderConfigId = Brand<string, "tax-provider-config">;
export type TaxCalculationId = Brand<string, "tax-calculation">;
export type TaxLineId = Brand<string, "tax-line">;
export type TaxCalculationPolicy = z.infer<typeof TaxCalculationPolicySchema>;
export type CreateTaxRegionInput = z.infer<typeof CreateTaxRegionInputSchema>;
export type TaxRegionRecord = Omit<
  z.infer<typeof TaxRegionRecordSchema>,
  "id" | "providerConfigId"
> & {
  readonly id: TaxRegionId;
  readonly providerConfigId: TaxProviderConfigId | null;
};
export type TaxRegionApiRecord = z.infer<typeof TaxRegionApiRecordSchema>;
export type CreateTaxRateInput = z.infer<typeof CreateTaxRateInputSchema>;
export type TaxRateRecord = Omit<
  z.infer<typeof TaxRateRecordSchema>,
  "categoryId" | "id" | "regionId"
> & {
  readonly categoryId: TaxCategoryId | null;
  readonly id: TaxRateId;
  readonly regionId: TaxRegionId;
};
export type TaxRateApiRecord = z.infer<typeof TaxRateApiRecordSchema>;
export type CreateTaxCategoryInput = z.infer<
  typeof CreateTaxCategoryInputSchema
>;
export type TaxCategoryRecord = Omit<
  z.infer<typeof TaxCategoryRecordSchema>,
  "id"
> & { readonly id: TaxCategoryId };
export type TaxCategoryApiRecord = z.infer<typeof TaxCategoryApiRecordSchema>;
export type CreateTaxProviderConfigInput = z.infer<
  typeof CreateTaxProviderConfigInputSchema
>;
export type TaxProviderConfigRecord = Omit<
  z.infer<typeof TaxProviderConfigRecordSchema>,
  "id"
> & { readonly id: TaxProviderConfigId };
export type TaxProviderConfigApiRecord = z.infer<
  typeof TaxProviderConfigApiRecordSchema
>;
export type CalculateTaxInput = z.infer<typeof CalculateTaxInputSchema>;
export type TaxLine = Omit<z.infer<typeof TaxLineSchema>, "id" | "rateId"> & {
  readonly id: TaxLineId;
  readonly rateId: TaxRateId | null;
};
export type TaxCalculationResult = Omit<
  z.infer<typeof TaxCalculationResultSchema>,
  "id" | "lines" | "regionId"
> & {
  readonly id: TaxCalculationId;
  readonly lines: TaxLine[];
  readonly regionId: TaxRegionId;
};

export interface TaxRepository {
  findActiveProviderConfigByKey(
    providerKey: string
  ): Promise<TaxProviderConfigRecord | null>;
  findCategoryById(id: TaxCategoryId): Promise<TaxCategoryRecord | null>;
  findProviderConfigById(
    id: TaxProviderConfigId
  ): Promise<TaxProviderConfigRecord | null>;
  findRatesByRegionId(regionId: TaxRegionId): Promise<readonly TaxRateRecord[]>;
  findRegionById(id: TaxRegionId): Promise<TaxRegionRecord | null>;
  saveCategory(category: TaxCategoryRecord): Promise<TaxCategoryRecord>;
  saveProviderConfig(
    providerConfig: TaxProviderConfigRecord
  ): Promise<TaxProviderConfigRecord>;
  saveRate(rate: TaxRateRecord): Promise<TaxRateRecord>;
  saveRegion(region: TaxRegionRecord): Promise<TaxRegionRecord>;
}
