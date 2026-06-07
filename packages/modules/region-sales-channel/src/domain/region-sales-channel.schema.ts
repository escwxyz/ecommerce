import { z } from "zod";

export const MetadataSchema = z.record(z.string(), z.unknown());

export const RegionProviderAvailabilitySchema = z.object({
  fulfillmentOptionIds: z.array(z.string().min(1)),
  paymentProviderIds: z.array(z.string().min(1)),
  taxProviderId: z.string().min(1).nullable(),
});

export const CreateRegionInputSchema = z.object({
  countries: z.array(z.string().min(2).max(2)).min(1),
  currencyCode: z.string().min(3).max(3),
  fulfillmentOptionIds: z.array(z.string().min(1)).optional(),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
  paymentProviderIds: z.array(z.string().min(1)).optional(),
  taxProviderId: z.string().min(1).nullable().optional(),
});

export const RegionIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("reg_"),
});

export const RegionRecordSchema = z.object({
  countries: z.array(z.string()),
  createdAt: z.date(),
  currencyCode: z.string(),
  id: z.string().min(1).startsWith("reg_"),
  metadata: MetadataSchema,
  name: z.string(),
  providerAvailability: RegionProviderAvailabilitySchema,
  updatedAt: z.date(),
});

export const RegionApiRecordSchema = RegionRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });

export const RegionApiListSchema = z.array(RegionApiRecordSchema);

export const ValidateRegionInputSchema = z.object({
  countryCode: z.string().min(2).max(2).optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  fulfillmentOptionId: z.string().min(1).optional(),
  paymentProviderId: z.string().min(1).optional(),
  regionId: z.string().min(1).startsWith("reg_"),
});

export const SalesChannelStatusSchema = z.enum(["draft", "active", "disabled"]);

export const CreateSalesChannelInputSchema = z.object({
  description: z.string().optional(),
  metadata: MetadataSchema.optional(),
  name: z.string().min(1),
  status: SalesChannelStatusSchema.optional(),
});

export const SalesChannelIdentifierSchema = z.object({
  id: z.string().min(1).startsWith("sc_"),
});

export const SalesChannelRecordSchema = z.object({
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.string().min(1).startsWith("sc_"),
  metadata: MetadataSchema,
  name: z.string(),
  productIds: z.array(z.string().min(1)),
  status: SalesChannelStatusSchema,
  updatedAt: z.date(),
});

export const SalesChannelApiRecordSchema = SalesChannelRecordSchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  });

export const SalesChannelApiListSchema = z.array(SalesChannelApiRecordSchema);

export const PublishProductInputSchema = z.object({
  productId: z.string().min(1),
  salesChannelId: z.string().min(1).startsWith("sc_"),
});

export const CheckPublishabilityInputSchema = PublishProductInputSchema;
