import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { regionSalesChannelAdminSurfaces } from "../admin";
import { regionSalesChannelPermissionList } from "../permissions";
import {
  REGION_CREATED_EVENT,
  RegionService,
  SALES_CHANNEL_CREATED_EVENT,
  SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
  SalesChannelService,
  createRegionServiceFromDependenciesLayer,
  createSalesChannelServiceFromDependenciesLayer,
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
    eventTypes: [
      REGION_CREATED_EVENT,
      SALES_CHANNEL_CREATED_EVENT,
      SALES_CHANNEL_PRODUCT_PUBLISHED_EVENT,
    ],
    permissions: regionSalesChannelPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "region-sales-channel:region-service",
        layer: createRegionServiceFromDependenciesLayer(),
        service: RegionService,
      }),
      defineCommerceModuleServiceContribution({
        key: "region-sales-channel:sales-channel-service",
        layer: createSalesChannelServiceFromDependenciesLayer(),
        service: SalesChannelService,
      }),
    ],
  },
  dependencies: ["notification-event"],
  key: "region-sales-channel",
});
