export {
  REGION_CREATED_EVENT,
  RegionService,
  createRegionService,
  createRegionServiceLayer,
  defaultRegionService,
  type CreateRegionServiceOptions,
  type RegionCreatedEventPayload,
  type RegionServiceShape,
} from "./region.service";
export {
  SALES_CHANNEL_CREATED_EVENT,
  SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
  SalesChannelService,
  createSalesChannelService,
  createSalesChannelServiceLayer,
  defaultSalesChannelService,
  type CreateSalesChannelServiceOptions,
  type SalesChannelCreatedEventPayload,
  type SalesChannelProductPublishedEventPayload,
  type SalesChannelServiceShape,
} from "./sales-channel.service";
