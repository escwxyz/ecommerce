import { z } from "zod";
// expand it to enum later if needed, but for now we can just validate it as a string
const CurrencyCodeSchema = z.string().trim().length(3).toUpperCase();

export const StoreIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("store_"),
});

export const StoreSettingsSchema = z.object({
  createdAt: z.date(),
  defaultCurrencyCode: CurrencyCodeSchema,
  defaultLocale: z.string().trim().min(1),
  defaultRegionId: z.string().trim().min(1).nullable(),
  defaultSalesChannelId: z.string().trim().min(1).nullable(),
  id: z.string().min(1).startsWith("store_"),
  metadata: z.record(z.string(), z.unknown()).readonly(),
  name: z.string().trim().min(1),
  supportedCurrencyCodes: z.array(CurrencyCodeSchema).min(1).readonly(),
  timezone: z.string().trim().min(1),
  updatedAt: z.date(),
});

export const UpdateStoreSettingsInputSchema = z.object({
  defaultCurrencyCode: CurrencyCodeSchema.optional(),
  defaultLocale: z.string().trim().min(1).optional(),
  defaultRegionId: z.string().trim().min(1).nullable().optional(),
  defaultSalesChannelId: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).readonly().optional(),
  name: z.string().trim().min(1).optional(),
  supportedCurrencyCodes: z
    .array(CurrencyCodeSchema)
    .min(1)
    .readonly()
    .optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const StoreDefaultsSchema = StoreSettingsSchema.pick({
  defaultCurrencyCode: true,
  defaultLocale: true,
  defaultRegionId: true,
  defaultSalesChannelId: true,
  supportedCurrencyCodes: true,
  timezone: true,
});

export const StoreApiRecordSchema = z.object({
  createdAt: z.string().min(1),
  defaultCurrencyCode: CurrencyCodeSchema,
  defaultLocale: z.string().min(1),
  defaultRegionId: z.string().min(1).nullable(),
  defaultSalesChannelId: z.string().min(1).nullable(),
  id: z.string().min(1).startsWith("store_"),
  metadata: z.record(z.string(), z.unknown()).readonly(),
  name: z.string().min(1),
  supportedCurrencyCodes: z.array(CurrencyCodeSchema).readonly(),
  timezone: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const StoreDefaultsApiRecordSchema = StoreApiRecordSchema.pick({
  defaultCurrencyCode: true,
  defaultLocale: true,
  defaultRegionId: true,
  defaultSalesChannelId: true,
  supportedCurrencyCodes: true,
  timezone: true,
});
