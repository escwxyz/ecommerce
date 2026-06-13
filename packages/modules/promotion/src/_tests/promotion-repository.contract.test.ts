import { describe, expect, it } from "bun:test";

import {
  createCampaignId,
  createPromotionId,
  createPromotionRedemptionId,
  type PromotionRepository,
} from "../domain";
import { createResettableInMemoryPromotionRepository } from "../repositories";

const createdAt = new Date("2026-01-01T00:00:00.000Z");

describe("promotion repository contracts", () => {
  it("saves and reads campaigns and promotions by id and code", async () => {
    const repository: PromotionRepository =
      createResettableInMemoryPromotionRepository();
    const campaign = {
      createdAt,
      description: null,
      id: createCampaignId("pcamp_contract"),
      metadata: {},
      name: "Contract campaign",
      updatedAt: createdAt,
    };
    const promotion = {
      applicationMethod: {
        allocation: "cart" as const,
        target: "subtotal" as const,
        type: "fixed" as const,
        value: 500,
      },
      campaignId: campaign.id,
      code: "SAVE500",
      createdAt,
      endsAt: null,
      id: createPromotionId("promo_contract"),
      metadata: {},
      startsAt: null,
      status: "active" as const,
      title: "Save 500",
      updatedAt: createdAt,
    };

    await repository.saveCampaign(campaign);
    await expect(repository.savePromotion(promotion)).resolves.toEqual(
      promotion
    );
    await expect(repository.findPromotionByCode("SAVE500")).resolves.toEqual(
      promotion
    );
    await expect(repository.findPromotionById(promotion.id)).resolves.toEqual(
      promotion
    );
  });

  it("counts redemptions for promotion usage limits", async () => {
    const repository: PromotionRepository =
      createResettableInMemoryPromotionRepository();
    const promotionId = createPromotionId("promo_contract");
    const redemption = {
      adjustmentIds: ["padj_contract"],
      cartId: "cart_contract",
      createdAt,
      id: createPromotionRedemptionId("pred_contract"),
      promotionId,
    };

    await expect(repository.countRedemptions(promotionId)).resolves.toBe(0);
    await repository.saveRedemption(redemption);
    await expect(repository.countRedemptions(promotionId)).resolves.toBe(1);
    await expect(repository.listRedemptions(promotionId)).resolves.toEqual([
      redemption,
    ]);
  });
});
