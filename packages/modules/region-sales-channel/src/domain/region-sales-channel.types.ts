import type { Brand } from "@ecommerce/core/brand";
import type { z } from "zod";

import type {
  CheckPublishabilityInputSchema,
  CreateRegionInputSchema,
  CreateSalesChannelInputSchema,
  PublishProductInputSchema,
  RegionApiRecordSchema,
  RegionIdentifierSchema,
  RegionProviderAvailabilitySchema,
  RegionRecordSchema,
  SalesChannelApiRecordSchema,
  SalesChannelIdentifierSchema,
  SalesChannelRecordSchema,
  SalesChannelStatusSchema,
  ValidateRegionInputSchema,
} from "./region-sales-channel.schema";

export type RegionId = Brand<string, "region">;
export type SalesChannelId = Brand<string, "sales-channel">;
export type RegionProviderAvailability = z.infer<
  typeof RegionProviderAvailabilitySchema
>;
export type CreateRegionInput = z.infer<typeof CreateRegionInputSchema>;
export type RegionIdentifierInput = z.infer<typeof RegionIdentifierSchema>;
export type RegionRecord = Omit<z.infer<typeof RegionRecordSchema>, "id"> & {
  readonly id: RegionId;
};
export type RegionApiRecord = z.infer<typeof RegionApiRecordSchema>;
export type ValidateRegionInput = z.infer<typeof ValidateRegionInputSchema>;
export type SalesChannelStatus = z.infer<typeof SalesChannelStatusSchema>;
export type CreateSalesChannelInput = z.infer<
  typeof CreateSalesChannelInputSchema
>;
export type SalesChannelIdentifierInput = z.infer<
  typeof SalesChannelIdentifierSchema
>;
export type SalesChannelRecord = Omit<
  z.infer<typeof SalesChannelRecordSchema>,
  "id"
> & {
  readonly id: SalesChannelId;
};
export type SalesChannelApiRecord = z.infer<typeof SalesChannelApiRecordSchema>;
export type PublishProductInput = z.infer<typeof PublishProductInputSchema>;
export type CheckPublishabilityInput = z.infer<
  typeof CheckPublishabilityInputSchema
>;

export interface RegionValidationResult {
  readonly allowed: boolean;
  readonly reasons: string[];
}

export interface SalesChannelPublishabilityResult {
  readonly publishable: boolean;
  readonly reasons: string[];
}

export interface RegionRepository {
  findRegionById(id: RegionId): Promise<RegionRecord | null>;
  listRegions(): Promise<readonly RegionRecord[]>;
  saveRegion(region: RegionRecord): Promise<RegionRecord>;
}

export interface SalesChannelRepository {
  findSalesChannelById(id: SalesChannelId): Promise<SalesChannelRecord | null>;
  listSalesChannels(): Promise<readonly SalesChannelRecord[]>;
  saveSalesChannel(channel: SalesChannelRecord): Promise<SalesChannelRecord>;
}
