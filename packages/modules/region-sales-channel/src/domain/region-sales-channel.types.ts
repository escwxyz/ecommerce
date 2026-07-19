import { Context } from "effect";
import type { Effect as EffectValue } from "effect/Effect";

import type { RegionSalesChannelExpectedError } from "./region-sales-channel.errors";
import type {
  CheckPublishabilityInputSchema,
  CreateRegionInputSchema,
  CreateSalesChannelInputSchema,
  MetadataSchema,
  PublishProductInputSchema,
  RegionApiListSchema,
  RegionApiRecordSchema,
  RegionIdentifierSchema,
  RegionIdSchema,
  RegionProviderAvailabilitySchema,
  RegionRecordSchema,
  RegionValidationResultSchema,
  SalesChannelApiListSchema,
  SalesChannelApiRecordSchema,
  SalesChannelIdentifierSchema,
  SalesChannelIdSchema,
  SalesChannelPublishabilityResultSchema,
  SalesChannelRecordSchema,
  SalesChannelStatusSchema,
  ValidateRegionInputSchema,
} from "./region-sales-channel.schema";

export type RegionId = typeof RegionIdSchema.Type;
export type SalesChannelId = typeof SalesChannelIdSchema.Type;
export type Metadata = typeof MetadataSchema.Type;
export type RegionProviderAvailability =
  typeof RegionProviderAvailabilitySchema.Type;
export type CreateRegionInput = typeof CreateRegionInputSchema.Type;
export type RegionIdentifierInput = typeof RegionIdentifierSchema.Type;
export type RegionRecord = typeof RegionRecordSchema.Type;
export type RegionApiRecord = typeof RegionApiRecordSchema.Type;
export type RegionApiList = typeof RegionApiListSchema.Type;
export type ValidateRegionInput = typeof ValidateRegionInputSchema.Type;
export type RegionValidationResult = typeof RegionValidationResultSchema.Type;
export type SalesChannelStatus = typeof SalesChannelStatusSchema.Type;
export type CreateSalesChannelInput = typeof CreateSalesChannelInputSchema.Type;
export type SalesChannelIdentifierInput =
  typeof SalesChannelIdentifierSchema.Type;
export type SalesChannelRecord = typeof SalesChannelRecordSchema.Type;
export type SalesChannelApiRecord = typeof SalesChannelApiRecordSchema.Type;
export type SalesChannelApiList = typeof SalesChannelApiListSchema.Type;
export type PublishProductInput = typeof PublishProductInputSchema.Type;
export type CheckPublishabilityInput =
  typeof CheckPublishabilityInputSchema.Type;
export type SalesChannelPublishabilityResult =
  typeof SalesChannelPublishabilityResultSchema.Type;

export interface RegionRepository {
  readonly findRegionById: (
    id: RegionId
  ) => EffectValue<RegionRecord | null, RegionSalesChannelExpectedError>;
  readonly listRegions: EffectValue<
    readonly RegionRecord[],
    RegionSalesChannelExpectedError
  >;
  readonly saveRegion: (
    region: RegionRecord
  ) => EffectValue<RegionRecord, RegionSalesChannelExpectedError>;
}

export interface SalesChannelRepository {
  readonly findSalesChannelById: (
    id: SalesChannelId
  ) => EffectValue<SalesChannelRecord | null, RegionSalesChannelExpectedError>;
  readonly listSalesChannels: EffectValue<
    readonly SalesChannelRecord[],
    RegionSalesChannelExpectedError
  >;
  readonly saveSalesChannel: (
    channel: SalesChannelRecord
  ) => EffectValue<SalesChannelRecord, RegionSalesChannelExpectedError>;
}

/** Effect-native region repository contract consumed by region services. */
export const RegionRepositoryService = Context.Service<RegionRepository>(
  "@ecommerce/region-sales-channel/RegionRepositoryService"
);

/** Effect-native sales-channel repository contract consumed by sales-channel services. */
export const SalesChannelRepositoryService =
  Context.Service<SalesChannelRepository>(
    "@ecommerce/region-sales-channel/SalesChannelRepositoryService"
  );
