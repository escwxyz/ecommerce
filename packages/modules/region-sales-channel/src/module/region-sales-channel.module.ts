import { defineCommerceModule } from "@ecommerce/core";

import { regionSalesChannelAdminSurfaces } from "../admin";
import { regionSalesChannelPermissionList } from "../permissions";
import {
  REGION_CREATED_EVENT,
  RegionService,
  SALES_CHANNEL_CREATED_EVENT,
  SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
  SalesChannelService,
} from "../services";

export const regionExtensionPoints = {
  constraintValidators: "region.constraint-validators",
  providerAvailabilityReferences: "region.provider-availability-references",
} as const;

export const salesChannelExtensionPoints = {
  availabilityScopeConsumers: "sales-channel.availability-scope-consumers",
  publishabilityFilters: "sales-channel.publishability-filters",
} as const;

export const regionSalesChannelModule = defineCommerceModule({
  contributions: {
    adminSurfaces: regionSalesChannelAdminSurfaces,
    apiFragments: [],
    eventTypes: [
      REGION_CREATED_EVENT,
      SALES_CHANNEL_CREATED_EVENT,
      SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
    ],
    permissions: regionSalesChannelPermissionList,
  },
  dependencies: [],
  key: "region-sales-channel",
  providedServices: [
    { key: "region-service", service: RegionService },
    { key: "sales-channel-service", service: SalesChannelService },
  ],
});
