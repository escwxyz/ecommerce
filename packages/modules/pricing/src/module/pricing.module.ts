import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { pricingAdminSurfaces } from "../admin";
import { pricingEffectHttpApiContribution } from "../http/api";
import { pricingPermissionList } from "../permissions";
import {
  PRICE_SET_CREATED_EVENT,
  PricingService,
  createPricingServiceFromDependenciesLayer,
} from "../services";

export const pricingExtensionPoints = {
  calculatedPriceConsumers: "pricing.calculated-price-consumers",
  priceRuleMatchers: "pricing.price-rule-matchers",
} as const;

export const pricingModule = defineCommerceModule({
  contributions: {
    adminSurfaces: pricingAdminSurfaces,
    apiGroups: pricingEffectHttpApiContribution.groups,
    eventTypes: [PRICE_SET_CREATED_EVENT],
    permissions: pricingPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "pricing:service",
        layer: createPricingServiceFromDependenciesLayer(),
        service: PricingService,
      }),
    ],
  },
  dependencies: [],
  key: "pricing",
});
