import { defineCommerceModule } from "@ecommerce/core";

import { promotionAdminSurfaces } from "../admin";
import {
  promotionCampaignTableName,
  promotionRedemptionTableName,
  promotionRuleTableName,
  promotionTableName,
  promotionUsageLimitTableName,
} from "../domain";
import { promotionPermissionList } from "../permissions";
import { promotionApiFragment } from "../router";
import {
  PROMOTION_ADJUSTMENTS_CALCULATED_EVENT,
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
    apiFragments: [promotionApiFragment],
    eventTypes: [
      PROMOTION_CREATED_EVENT,
      PROMOTION_ADJUSTMENTS_CALCULATED_EVENT,
      PROMOTION_REDEMPTION_RECORDED_EVENT,
    ],
    permissions: promotionPermissionList,
  },
  dependencies: [],
  key: "promotion",
  providedServices: [{ key: "promotion-service", service: PromotionService }],
  schema: {
    tables: [
      promotionCampaignTableName,
      promotionTableName,
      promotionRuleTableName,
      promotionUsageLimitTableName,
      promotionRedemptionTableName,
    ],
  },
});
