import { z } from "zod";

const CurrencyCodeSchema = z.string().trim().length(3).toUpperCase();
const TrimmedStringSchema = z.string().trim().min(1);

/**
 * Temporary oRPC/Zod bridge for the legacy store route contract.
 *
 * Domain, API, and storage ownership for the store module has moved to Effect
 * Schema. These Zod schemas stay local to the legacy oRPC contract until task
 * 6.7 replaces the store router with Effect `HttpApi` groups.
 */
export const StoreApiRecordContractSchema = z.object({
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

export const StoreDefaultsApiRecordContractSchema =
  StoreApiRecordContractSchema.pick({
    defaultCurrencyCode: true,
    defaultLocale: true,
    defaultRegionId: true,
    defaultSalesChannelId: true,
    supportedCurrencyCodes: true,
    timezone: true,
  });

export const UpdateStoreSettingsInputContractSchema = z.object({
  defaultCurrencyCode: CurrencyCodeSchema.optional(),
  defaultLocale: TrimmedStringSchema.optional(),
  defaultRegionId: TrimmedStringSchema.nullable().optional(),
  defaultSalesChannelId: TrimmedStringSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).readonly().optional(),
  name: TrimmedStringSchema.optional(),
  supportedCurrencyCodes: z.array(CurrencyCodeSchema).min(1).readonly().optional(),
  timezone: TrimmedStringSchema.optional(),
});
