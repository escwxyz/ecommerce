import {
  defineCommerceModule,
  defineCommerceModuleServiceContribution,
} from "@ecommerce/core";

import { promotionAdminSurfaces } from "../admin";
import { promotionPermissionList } from "../permissions";
import {
  PROMOTION_CREATED_EVENT,
  PROMOTION_REDEMPTION_RECORDED_EVENT,
  PromotionServiceLive,
  PromotionService,
} from "../services";

export const promotionExtensionPoints = {
  adjustmentConsumers: "promotion.adjustment-consumers",
  ruleMatchers: "promotion.rule-matchers",
  usageLimitPolicies: "promotion.usage-limit-policies",
} as const;

export const promotionModule = defineCommerceModule({
  contributions: {
    adminSurfaces: promotionAdminSurfaces,
    eventTypes: [PROMOTION_CREATED_EVENT, PROMOTION_REDEMPTION_RECORDED_EVENT],
    permissions: promotionPermissionList,
    services: [
      defineCommerceModuleServiceContribution({
        key: "promotion:service",
        layer: PromotionServiceLive,
        service: PromotionService,
      }),
    ],
  },
  dependencies: [],
  key: "promotion",
});
