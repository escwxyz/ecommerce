import { defineCommerceModule } from "@ecommerce/core";

import { pricingAdminSurfaces } from "../admin";
import { pricingPermissionList } from "../permissions";
import { pricingApiFragment } from "../router";
import {
  PRICE_CALCULATED_EVENT,
  PRICE_SET_CREATED_EVENT,
  PricingService,
} from "../services";

export const pricingExtensionPoints = {
  calculatedPriceConsumers: "pricing.calculated-price-consumers",
  priceRuleMatchers: "pricing.price-rule-matchers",
} as const;

export const pricingModule = defineCommerceModule({
  contributions: {
    adminSurfaces: pricingAdminSurfaces,
    apiFragments: [pricingApiFragment],
    eventTypes: [PRICE_SET_CREATED_EVENT, PRICE_CALCULATED_EVENT],
    permissions: pricingPermissionList,
  },
  dependencies: [],
  key: "pricing",
  providedServices: [{ key: "pricing-service", service: PricingService }],
});
