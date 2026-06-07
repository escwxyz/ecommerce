import type { RegionId, SalesChannelId } from "./region-sales-channel.types";

export const REGION_ID_PREFIX = "reg_" as const;
export const SALES_CHANNEL_ID_PREFIX = "sc_" as const;

export const createRegionId = (value: string): RegionId => value as RegionId;
export const serializeRegionId = (id: RegionId): string => id;

export const createSalesChannelId = (value: string): SalesChannelId =>
  value as SalesChannelId;
export const serializeSalesChannelId = (id: SalesChannelId): string => id;
