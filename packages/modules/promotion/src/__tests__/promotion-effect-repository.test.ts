import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createCampaignId,
  createPromotionAdjustmentId,
  createPromotionId,
  createPromotionRedemptionId,
  createPromotionRuleId,
  createPromotionUsageLimitId,
  type PromotionRepository,
} from "../domain";
import { createResettableInMemoryPromotionRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

const createCampaign = () => ({
  createdAt,
  description: null,
  id: createCampaignId("pcamp_contract"),
  metadata: {},
  name: "Contract campaign",
  updatedAt: createdAt,
});

const createPromotion = (
  campaignId: ReturnType<typeof createCampaign>["id"]
) => ({
  applicationMethod: {
    allocation: "cart" as const,
    target: "subtotal" as const,
    type: "fixed" as const,
    value: 500,
  },
  campaignId,
  code: "SAVE500",
  createdAt,
  endsAt: null,
  id: createPromotionId("promo_contract"),
  metadata: {},
  startsAt: null,
  status: "active" as const,
  title: "Save 500",
  updatedAt: createdAt,
});

const runPromotionRepositoryContract = (
  name: string,
  createRepository: () => PromotionRepository
) => {
  describe(name, () => {
    it("saves and reads campaigns and promotions by id and code", async () => {
      const repository = createRepository();
      const campaign = createCampaign();
      const promotion = createPromotion(campaign.id);

      await Effect.runPromise(repository.saveCampaign(campaign));
      await expect(
        Effect.runPromise(repository.savePromotion(promotion))
      ).resolves.toEqual(promotion);
      await expect(
        Effect.runPromise(repository.findCampaignById(campaign.id))
      ).resolves.toEqual(campaign);
      await expect(
        Effect.runPromise(repository.findPromotionByCode("save500"))
      ).resolves.toEqual(promotion);
      await expect(
        Effect.runPromise(repository.findPromotionById(promotion.id))
      ).resolves.toEqual(promotion);
    });

    it("saves rules, usage limits, and automatic promotions", async () => {
      const repository = createRepository();
      const campaign = createCampaign();
      const promotion = createPromotion(campaign.id);
      const automaticPromotion = {
        ...createPromotion(campaign.id),
        code: null,
        id: createPromotionId("promo_automatic"),
      };
      const rule = {
        attribute: "region",
        createdAt,
        id: createPromotionRuleId("prule_contract"),
        promotionId: promotion.id,
        updatedAt: createdAt,
        value: "EU",
      };
      const usageLimit = {
        createdAt,
        id: createPromotionUsageLimitId("plimit_contract"),
        limit: 1,
        promotionId: promotion.id,
        scope: "total" as const,
        updatedAt: createdAt,
      };

      await Effect.runPromise(repository.saveCampaign(campaign));
      await Effect.runPromise(repository.savePromotion(promotion));
      await Effect.runPromise(repository.savePromotion(automaticPromotion));
      await expect(
        Effect.runPromise(repository.saveRule(rule))
      ).resolves.toEqual(rule);
      await expect(
        Effect.runPromise(repository.saveUsageLimit(usageLimit))
      ).resolves.toEqual(usageLimit);
      await expect(
        Effect.runPromise(repository.findRulesByPromotionId(promotion.id))
      ).resolves.toEqual([rule]);
      await expect(
        Effect.runPromise(repository.findUsageLimitsByPromotionId(promotion.id))
      ).resolves.toEqual([usageLimit]);
      await expect(
        Effect.runPromise(repository.listAutomaticPromotions)
      ).resolves.toEqual([automaticPromotion]);
    });

    it("counts redemptions for promotion usage limits", async () => {
      const repository = createRepository();
      const promotionId = createPromotionId("promo_contract");
      const redemption = {
        adjustmentIds: [createPromotionAdjustmentId("padj_contract")],
        cartId: "cart_contract",
        createdAt,
        id: createPromotionRedemptionId("pred_contract"),
        promotionId,
      };

      await expect(
        Effect.runPromise(repository.countRedemptions(promotionId))
      ).resolves.toBe(0);
      await Effect.runPromise(repository.saveRedemption(redemption));
      await expect(
        Effect.runPromise(repository.countRedemptions(promotionId))
      ).resolves.toBe(1);
      await expect(
        Effect.runPromise(repository.listRedemptions(promotionId))
      ).resolves.toEqual([redemption]);
    });
  });
};

runPromotionRepositoryContract("in-memory promotion repository", () =>
  createResettableInMemoryPromotionRepository()
);
