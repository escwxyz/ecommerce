import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { promotionContractRouter } from "../contracts";
import { promotionModule } from "../module";
import { createResettableInMemoryPromotionRepository } from "../repositories";
import { createPromotionRouteFragment } from "../router";
import { createPromotionService } from "../services";

const createAllowedContext = () =>
  ({
    context: {
      auth: {},
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        user: {
          email: "ada@example.com",
          id: "user_1",
        },
      },
    },
  }) as const;

describe("promotion module foundation", () => {
  it("declares service, owned data, events, permissions, and extension points", () => {
    expect(promotionModule.key).toBe("promotion");
    expect(promotionModule.providedServices?.map(({ key }) => key)).toEqual([
      "promotion-service",
    ]);
    expect(promotionModule.contributions?.eventTypes).toEqual([
      "promotion.created",
      "promotion.adjustments-calculated",
      "promotion.redemption-recorded",
    ]);
    expect(promotionModule.schema?.tables).toEqual([
      "promotion_campaign",
      "promotion_promotion",
      "promotion_rule",
      "promotion_usage_limit",
      "promotion_redemption",
    ]);
  });

  it("validates discount codes and returns traceable adjustments separate from pricing and tax", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const eventCollector = createEventCollector();
    const service = createPromotionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "pcamp_winter",
        "promo_save10",
        "evt_created",
        "prule_region",
        "plimit_total",
        "padj_cart",
        "evt_adjusted",
        "pred_checkout",
        "evt_redemption",
      ]),
      repository,
    });

    const campaign = await service.createCampaign({
      description: "Winter campaign",
      name: "Winter",
    });
    const promotion = await service.createPromotion({
      applicationMethod: {
        allocation: "cart",
        target: "subtotal",
        type: "percentage",
        value: 10,
      },
      campaignId: campaign.id,
      code: " save10 ",
      status: "active",
      title: "Save 10",
    });
    await service.createPromotionRule({
      attribute: "regionId",
      promotionId: promotion.id,
      value: "reg_us",
    });
    await service.createUsageLimit({
      limit: 2,
      promotionId: promotion.id,
      scope: "total",
    });

    const result = await service.calculateAdjustments({
      cart: {
        currencyCode: "usd",
        id: "cart_1",
        subtotal: 5000,
      },
      context: {
        regionId: "reg_us",
      },
      promotionCodes: ["save10"],
    });

    expect(result).toMatchObject({
      adjustments: [
        {
          amount: -500,
          currencyCode: "USD",
          promotionId: "promo_save10",
          trace: {
            promotionCode: "SAVE10",
            ruleMatches: ["regionId:reg_us"],
            source: "discount-code",
          },
        },
      ],
      cartId: "cart_1",
      currencyCode: "USD",
      subtotal: 5000,
      totalDiscount: -500,
    });
    expect(result.adjustments[0]).not.toHaveProperty("taxAmount");
    expect(result.adjustments[0]).not.toHaveProperty("basePrice");
    expect(result.adjustments[0]).not.toHaveProperty("orderTotal");

    await service.recordRedemption({
      adjustmentIds: result.adjustments.map((adjustment) => adjustment.id),
      cartId: "cart_1",
      promotionId: promotion.id,
    });

    await expect(
      service.calculateAdjustments({
        cart: {
          currencyCode: "usd",
          id: "cart_2",
          subtotal: 5000,
        },
        context: {
          regionId: "reg_us",
        },
        promotionCodes: ["save10"],
      })
    ).resolves.toMatchObject({
      adjustments: [
        {
          amount: -500,
        },
      ],
    });

    await service.recordRedemption({
      adjustmentIds: ["padj_cart"],
      cartId: "cart_2",
      promotionId: promotion.id,
    });

    await expect(
      service.calculateAdjustments({
        cart: {
          currencyCode: "usd",
          id: "cart_3",
          subtotal: 5000,
        },
        context: {
          regionId: "reg_us",
        },
        promotionCodes: ["save10"],
      })
    ).resolves.toMatchObject({
      adjustments: [],
      totalDiscount: 0,
    });
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "promotion.created",
      "promotion.adjustments-calculated",
      "promotion.redemption-recorded",
      "promotion.adjustments-calculated",
      "promotion.redemption-recorded",
      "promotion.adjustments-calculated",
    ]);
  });

  it("caps percentage promotions at one hundred percent", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const service = createPromotionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["pcamp_cap", "promo_cap"]),
      repository,
    });

    const campaign = await service.createCampaign({
      name: "Cap campaign",
    });
    await service.createPromotion({
      applicationMethod: {
        allocation: "cart",
        target: "subtotal",
        type: "percentage",
        value: 150,
      },
      campaignId: campaign.id,
      code: "CAP150",
      status: "active",
      title: "Cap 150",
    });

    await expect(
      service.calculateAdjustments({
        cart: {
          currencyCode: "USD",
          id: "cart_cap",
          subtotal: 10000,
        },
        promotionCodes: ["CAP150"],
      })
    ).resolves.toMatchObject({
      adjustments: [
        {
          amount: -10000,
          trace: {
            promotionCode: "CAP150",
          },
        },
      ],
      totalDiscount: -10000,
    });
  });

  it("deduplicates promotion codes before discounting", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const service = createPromotionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["pcamp_dup", "promo_dup"]),
      repository,
    });

    const campaign = await service.createCampaign({
      name: "Duplicate code campaign",
    });
    await service.createPromotion({
      applicationMethod: {
        allocation: "cart",
        target: "subtotal",
        type: "fixed",
        value: 100,
      },
      campaignId: campaign.id,
      code: "SAVE10",
      status: "active",
      title: "Save 10",
    });

    await expect(
      service.calculateAdjustments({
        cart: {
          currencyCode: "USD",
          id: "cart_dup",
          subtotal: 1000,
        },
        promotionCodes: ["SAVE10", "save10"],
      })
    ).resolves.toMatchObject({
      adjustments: [
        {
          amount: -100,
          promotionId: "promo_dup",
        },
      ],
      totalDiscount: -100,
    });
  });

  it("declares contract-first route metadata", () => {
    expect(
      promotionContractRouter.promotionAdjustmentsCalculate["~orpc"].route.tags
    ).toEqual(["Promotion"]);
  });

  it("builds route fragments with injected repositories", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const fragment = createPromotionRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "pcamp_route",
        "promo_route",
        "evt_created",
        "padj_route",
        "evt_adjusted",
      ]),
      repository,
    });
    const context = createAllowedContext();

    const campaign = await call(
      fragment.router.promotionCampaignCreate,
      {
        name: "Route campaign",
      },
      context
    );
    const promotion = await call(
      fragment.router.promotionCreate,
      {
        applicationMethod: {
          allocation: "cart",
          target: "subtotal",
          type: "fixed",
          value: 100,
        },
        campaignId: campaign.id,
        code: "ROUTE100",
        status: "active",
        title: "Route discount",
      },
      context
    );

    await expect(
      call(
        fragment.router.promotionAdjustmentsCalculate,
        {
          cart: {
            currencyCode: "USD",
            id: "cart_route",
            subtotal: 1000,
          },
          promotionCodes: ["ROUTE100"],
        },
        context
      )
    ).resolves.toMatchObject({
      adjustments: [
        {
          amount: -100,
          promotionId: promotion.id,
        },
      ],
      totalDiscount: -100,
    });
  });
});
