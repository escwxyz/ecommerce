import type {
  TaxCalculationId,
  TaxCategoryId,
  TaxLineId,
  TaxProviderConfigId,
  TaxRateId,
  TaxRegionId,
} from "./tax.types";

export const TAX_REGION_ID_PREFIX = "txreg_" as const;
export const TAX_RATE_ID_PREFIX = "txrate_" as const;
export const TAX_CATEGORY_ID_PREFIX = "txcat_" as const;
export const TAX_PROVIDER_CONFIG_ID_PREFIX = "txprov_" as const;
export const TAX_CALCULATION_ID_PREFIX = "txcalc_" as const;
export const TAX_LINE_ID_PREFIX = "txline_" as const;

export const createTaxRegionId = (value: string): TaxRegionId =>
  value as TaxRegionId;
export const serializeTaxRegionId = (id: TaxRegionId): string => id;

export const createTaxRateId = (value: string): TaxRateId => value as TaxRateId;
export const serializeTaxRateId = (id: TaxRateId): string => id;

export const createTaxCategoryId = (value: string): TaxCategoryId =>
  value as TaxCategoryId;
export const serializeTaxCategoryId = (id: TaxCategoryId): string => id;

export const createTaxProviderConfigId = (value: string): TaxProviderConfigId =>
  value as TaxProviderConfigId;
export const serializeTaxProviderConfigId = (id: TaxProviderConfigId): string =>
  id;

export const createTaxCalculationId = (value: string): TaxCalculationId =>
  value as TaxCalculationId;
export const serializeTaxCalculationId = (id: TaxCalculationId): string => id;

export const createTaxLineId = (value: string): TaxLineId => value as TaxLineId;
export const serializeTaxLineId = (id: TaxLineId): string => id;
