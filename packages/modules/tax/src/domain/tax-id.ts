import { Effect, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import { TaxInvalidIdentifier } from "./tax.errors";
import {
  TAX_CALCULATION_ID_PREFIX,
  TAX_CATEGORY_ID_PREFIX,
  TAX_LINE_ID_PREFIX,
  TAX_PROVIDER_CONFIG_ID_PREFIX,
  TAX_RATE_ID_PREFIX,
  TAX_REGION_ID_PREFIX,
  TaxCalculationIdSchema,
  TaxCategoryIdSchema,
  TaxLineIdSchema,
  TaxProviderConfigIdSchema,
  TaxRateIdSchema,
  TaxRegionIdSchema,
} from "./tax.schema";
import type {
  TaxCalculationId,
  TaxCategoryId,
  TaxLineId,
  TaxProviderConfigId,
  TaxRateId,
  TaxRegionId,
} from "./tax.types";

const toInvalidIdentifier = (
  expectedPrefix: string,
  value: string
): TaxInvalidIdentifier => new TaxInvalidIdentifier({ expectedPrefix, value });

export const createTaxRegionId = (value: string): TaxRegionId =>
  value as TaxRegionId;
export const createTaxRegionIdEffect = (
  value: string
): EffectValue<TaxRegionId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxRegionIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(TAX_REGION_ID_PREFIX, value))
  );
export const serializeTaxRegionId = (id: TaxRegionId): string => id;

export const createTaxRateId = (value: string): TaxRateId => value as TaxRateId;
export const createTaxRateIdEffect = (
  value: string
): EffectValue<TaxRateId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxRateIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(TAX_RATE_ID_PREFIX, value))
  );
export const serializeTaxRateId = (id: TaxRateId): string => id;

export const createTaxCategoryId = (value: string): TaxCategoryId =>
  value as TaxCategoryId;
export const createTaxCategoryIdEffect = (
  value: string
): EffectValue<TaxCategoryId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxCategoryIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(TAX_CATEGORY_ID_PREFIX, value))
  );
export const serializeTaxCategoryId = (id: TaxCategoryId): string => id;

export const createTaxProviderConfigId = (value: string): TaxProviderConfigId =>
  value as TaxProviderConfigId;
export const createTaxProviderConfigIdEffect = (
  value: string
): EffectValue<TaxProviderConfigId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxProviderConfigIdSchema)(value).pipe(
    Effect.mapError(() =>
      toInvalidIdentifier(TAX_PROVIDER_CONFIG_ID_PREFIX, value)
    )
  );
export const serializeTaxProviderConfigId = (id: TaxProviderConfigId): string =>
  id;

export const createTaxCalculationId = (value: string): TaxCalculationId =>
  value as TaxCalculationId;
export const createTaxCalculationIdEffect = (
  value: string
): EffectValue<TaxCalculationId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxCalculationIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(TAX_CALCULATION_ID_PREFIX, value))
  );
export const serializeTaxCalculationId = (id: TaxCalculationId): string => id;

export const createTaxLineId = (value: string): TaxLineId => value as TaxLineId;
export const createTaxLineIdEffect = (
  value: string
): EffectValue<TaxLineId, TaxInvalidIdentifier> =>
  Schema.decodeUnknownEffect(TaxLineIdSchema)(value).pipe(
    Effect.mapError(() => toInvalidIdentifier(TAX_LINE_ID_PREFIX, value))
  );
export const serializeTaxLineId = (id: TaxLineId): string => id;
