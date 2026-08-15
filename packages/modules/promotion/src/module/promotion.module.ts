import { defineCommerceModule } from "@ecommerce/core";

import { promotionAdminSurfaces } from "../admin";
import { promotionPermissionList } from "../permissions";
import {
  PROMOTION_CREATED_EVENT,
  PROMOTION_REDEMPTION_RECORDED_EVENT,
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
    apiFragments: [],
    eventTypes: [PROMOTION_CREATED_EVENT, PROMOTION_REDEMPTION_RECORDED_EVENT],
    permissions: promotionPermissionList,
  },
  dependencies: [],
  key: "promotion",
  providedServices: [{ key: "promotion-service", service: PromotionService }],
});
