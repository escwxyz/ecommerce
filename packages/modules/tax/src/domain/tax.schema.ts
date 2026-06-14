import { z } from "zod";

const MetadataSchema = z.record(z.string(), z.unknown());
const ProviderSettingsSchema = z.record(z.string(), z.unknown());

export const TaxCalculationPolicySchema = z.object({
  pricesIncludeTax: z.boolean(),
  roundAt: z.enum(["line", "total"]).default("line"),
});

export const TaxRegionRecordSchema = z.object({
  code: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("txreg_"),
  metadata: MetadataSchema,
  name: z.string().min(1),
  providerConfigId: z.string().min(1).startsWith("txprov_").nullable(),
  updatedAt: z.date(),
});

export const CreateTaxRegionInputSchema = z.object({
  code: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
  providerConfigId: z.string().min(1).startsWith("txprov_").optional(),
});

export const TaxRateRecordSchema = z.object({
  categoryId: z.string().min(1).startsWith("txcat_").nullable(),
  createdAt: z.date(),
  id: z.string().min(1).startsWith("txrate_"),
  metadata: MetadataSchema,
  name: z.string().min(1),
  percentage: z.number().nonnegative().max(100),
  regionId: z.string().min(1).startsWith("txreg_"),
  updatedAt: z.date(),
});

export const CreateTaxRateInputSchema = z.object({
  categoryId: z.string().min(1).startsWith("txcat_").optional(),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
  percentage: z.number().nonnegative().max(100),
  regionId: z.string().min(1).startsWith("txreg_"),
});

export const TaxCategoryRecordSchema = z.object({
  code: z.string().min(1),
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string().min(1).startsWith("txcat_"),
  metadata: MetadataSchema,
  name: z.string().min(1),
  updatedAt: z.date(),
});

export const CreateTaxCategoryInputSchema = z.object({
  code: z.string().min(1),
  description: z.string().optional(),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
});

export const TaxProviderConfigRecordSchema = z.object({
  createdAt: z.date(),
  id: z.string().min(1).startsWith("txprov_"),
  isActive: z.boolean(),
  metadata: MetadataSchema,
  providerKey: z.string().min(1),
  settings: ProviderSettingsSchema,
  updatedAt: z.date(),
});

export const CreateTaxProviderConfigInputSchema = z.object({
  isActive: z.boolean().optional(),
  metadata: MetadataSchema.optional(),
  providerKey: z.string().min(1),
  settings: ProviderSettingsSchema.optional(),
});

export const TaxAddressInputSchema = z.object({
  city: z.string().min(1).optional(),
  countryCode: z.string().min(2).max(2),
  postalCode: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
});

export const TaxCalculationLineInputSchema = z.object({
  adjustmentsTotal: z.number().int().nonpositive().optional(),
  id: z.string().min(1),
  quantity: z.number().int().positive(),
  subtotal: z.number().int().nonnegative(),
  taxCategoryId: z.string().min(1).startsWith("txcat_").optional(),
});

export const CalculateTaxInputSchema = z.object({
  address: TaxAddressInputSchema,
  currencyCode: z.string().min(3).max(3),
  items: z.array(TaxCalculationLineInputSchema).min(1),
  policy: TaxCalculationPolicySchema,
  regionId: z.string().min(1).startsWith("txreg_"),
});

export const TaxLineSchema = z.object({
  amount: z.number().int().nonnegative(),
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("txline_"),
  itemId: z.string().min(1),
  rate: z.number().nonnegative().max(100),
  rateId: z.string().min(1).startsWith("txrate_").nullable(),
  taxableAmount: z.number().int().nonnegative(),
});

export const TaxCalculationResultSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  id: z.string().min(1).startsWith("txcalc_"),
  lines: z.array(TaxLineSchema),
  providerKey: z.string().min(1),
  regionId: z.string().min(1).startsWith("txreg_"),
  totalTax: z.number().int().nonnegative(),
});

export const TaxRegionApiRecordSchema = TaxRegionRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const TaxRateApiRecordSchema = TaxRateRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const TaxCategoryApiRecordSchema = TaxCategoryRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const TaxProviderConfigApiRecordSchema =
  TaxProviderConfigRecordSchema.extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });
