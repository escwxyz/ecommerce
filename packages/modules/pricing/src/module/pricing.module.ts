import { defineCommerceModule } from "@ecommerce/core";

import { pricingAdminSurfaces } from "../admin";
import { pricingPermissionList } from "../permissions";
import { PRICE_SET_CREATED_EVENT, PricingService } from "../services";

export const pricingExtensionPoints = {
  calculatedPriceConsumers: "pricing.calculated-price-consumers",
  priceRuleMatchers: "pricing.price-rule-matchers",
} as const;

export const pricingModule = defineCommerceModule({
  contributions: {
    adminSurfaces: pricingAdminSurfaces,
    apiFragments: [],
    eventTypes: [PRICE_SET_CREATED_EVENT],
    permissions: pricingPermissionList,
  },
  dependencies: [],
  key: "pricing",
  providedServices: [{ key: "pricing-service", service: PricingService }],
});
