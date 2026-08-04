import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { TaxExpectedError } from "./tax.errors";
import type {
  CalculateTaxInputSchema,
  CreateTaxCategoryInputSchema,
  CreateTaxProviderConfigInputSchema,
  CreateTaxRateInputSchema,
  CreateTaxRegionInputSchema,
  TaxCalculationIdSchema,
  TaxCalculationPolicySchema,
  TaxCalculationResultApiSchema,
  TaxCalculationResultSchema,
  TaxCategoryApiRecordSchema,
  TaxCategoryIdSchema,
  TaxCategoryRecordSchema,
  TaxLineApiSchema,
  TaxLineIdSchema,
  TaxLineSchema,
  TaxProviderConfigApiRecordSchema,
  TaxProviderConfigIdSchema,
  TaxProviderConfigRecordSchema,
  TaxRateApiRecordSchema,
  TaxRateIdSchema,
  TaxRateRecordSchema,
  TaxRegionApiRecordSchema,
  TaxRegionIdSchema,
  TaxRegionRecordSchema,
} from "./tax.schema";

export type TaxRegionId = typeof TaxRegionIdSchema.Type;
export type TaxRateId = typeof TaxRateIdSchema.Type;
export type TaxCategoryId = typeof TaxCategoryIdSchema.Type;
export type TaxProviderConfigId = typeof TaxProviderConfigIdSchema.Type;
export type TaxCalculationId = typeof TaxCalculationIdSchema.Type;
export type TaxLineId = typeof TaxLineIdSchema.Type;
export type TaxCalculationPolicy = typeof TaxCalculationPolicySchema.Type;
export type CreateTaxRegionInput = typeof CreateTaxRegionInputSchema.Type;
export type TaxRegionRecord = typeof TaxRegionRecordSchema.Type;
export type TaxRegionApiRecord = typeof TaxRegionApiRecordSchema.Type;
export type CreateTaxRateInput = typeof CreateTaxRateInputSchema.Type;
export type TaxRateRecord = typeof TaxRateRecordSchema.Type;
export type TaxRateApiRecord = typeof TaxRateApiRecordSchema.Type;
export type CreateTaxCategoryInput = typeof CreateTaxCategoryInputSchema.Type;
export type TaxCategoryRecord = typeof TaxCategoryRecordSchema.Type;
export type TaxCategoryApiRecord = typeof TaxCategoryApiRecordSchema.Type;
export type CreateTaxProviderConfigInput =
  typeof CreateTaxProviderConfigInputSchema.Type;
export type TaxProviderConfigRecord = typeof TaxProviderConfigRecordSchema.Type;
export type TaxProviderConfigApiRecord =
  typeof TaxProviderConfigApiRecordSchema.Type;
export type CalculateTaxInput = typeof CalculateTaxInputSchema.Type;
export type TaxLine = typeof TaxLineSchema.Type;
export type TaxLineApi = typeof TaxLineApiSchema.Type;
export type TaxCalculationResult = typeof TaxCalculationResultSchema.Type;
export type TaxCalculationResultApi = typeof TaxCalculationResultApiSchema.Type;

export interface TaxRepository {
  readonly findActiveProviderConfigByKey: (
    providerKey: string
  ) => EffectValue<TaxProviderConfigRecord | null, TaxExpectedError>;
  readonly findCategoryById: (
    id: TaxCategoryId
  ) => EffectValue<TaxCategoryRecord | null, TaxExpectedError>;
  readonly findProviderConfigById: (
    id: TaxProviderConfigId
  ) => EffectValue<TaxProviderConfigRecord | null, TaxExpectedError>;
  readonly findRatesByRegionId: (
    regionId: TaxRegionId
  ) => EffectValue<readonly TaxRateRecord[], TaxExpectedError>;
  readonly findRegionById: (
    id: TaxRegionId
  ) => EffectValue<TaxRegionRecord | null, TaxExpectedError>;
  readonly saveCategory: (
    category: TaxCategoryRecord
  ) => EffectValue<TaxCategoryRecord, TaxExpectedError>;
  readonly saveProviderConfig: (
    providerConfig: TaxProviderConfigRecord
  ) => EffectValue<TaxProviderConfigRecord, TaxExpectedError>;
  readonly saveRate: (
    rate: TaxRateRecord
  ) => EffectValue<TaxRateRecord, TaxExpectedError>;
  readonly saveRegion: (
    region: TaxRegionRecord
  ) => EffectValue<TaxRegionRecord, TaxExpectedError>;
}

/** Effect-native tax repository contract consumed by tax services. */
export const TaxRepositoryService = Context.Service<TaxRepository>(
  "@ecommerce/tax/TaxRepositoryService"
);
