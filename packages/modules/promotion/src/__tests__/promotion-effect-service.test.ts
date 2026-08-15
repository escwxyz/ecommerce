import { describe, expect, it } from "bun:test";

import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import { PromotionUnsupportedUsageLimitScope } from "../domain";
import { createResettableInMemoryPromotionRepository } from "../repositories";
import { createPromotionService } from "../services";

const createMutationPersistence = () => {
  const outbox = createInMemoryOutbox();
  return {
    outbox,
    outboxWriter: outbox.writer,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [outbox],
    }),
  };
};

describe("promotion Effect service", () => {
  it("calculates adjustments without opening a transaction", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const outbox = createInMemoryOutbox();
    const service = createPromotionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        failBegin: true,
        resources: [outbox],
      }),
    });

    await expect(
      Effect.runPromise(
        service.calculateAdjustments({
          cart: {
            currencyCode: "usd",
            id: "cart_empty",
            subtotal: 1000,
          },
        })
      )
    ).resolves.toMatchObject({
      adjustments: [],
      currencyCode: "USD",
      totalDiscount: 0,
    });
    expect(outbox.records).toEqual([]);
  });

  it("validates discount codes and returns traceable adjustments separate from pricing and tax", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const mutationPersistence = createMutationPersistence();
    const service = createPromotionService({
      ...mutationPersistence,
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "pcamp_winter",
        "promo_save10",
        "evt_created",
        "prule_region",
        "plimit_total",
        "padj_cart",
        "pred_checkout",
        "evt_redemption",
      ]),
      repository,
    });

    const campaign = await Effect.runPromise(
      service.createCampaign({
        description: "Winter campaign",
        name: "Winter",
      })
    );
    const promotion = await Effect.runPromise(
      service.createPromotion({
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
      })
    );
    await Effect.runPromise(
      service.createPromotionRule({
        attribute: "regionId",
        promotionId: promotion.id,
        value: "reg_us",
      })
    );
    await Effect.runPromise(
      service.createUsageLimit({
        limit: 2,
        promotionId: promotion.id,
        scope: "total",
      })
    );

    const result = await Effect.runPromise(
      service.calculateAdjustments({
        cart: {
          currencyCode: "usd",
          id: "cart_1",
          subtotal: 5000,
        },
        context: {
          regionId: "reg_us",
        },
        promotionCodes: ["save10"],
      })
    );

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

    await Effect.runPromise(
      service.recordRedemption({
        adjustmentIds: result.adjustments.map((adjustment) => adjustment.id),
        cartId: "cart_1",
        promotionId: promotion.id,
      })
    );

    await expect(
      Effect.runPromise(
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
      )
    ).resolves.toMatchObject({
      adjustments: [
        {
          amount: -500,
        },
      ],
    });

    await Effect.runPromise(
      service.recordRedemption({
        adjustmentIds: result.adjustments.map((adjustment) => adjustment.id),
        cartId: "cart_2",
        promotionId: promotion.id,
      })
    );

    await expect(
      Effect.runPromise(
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
      )
    ).resolves.toMatchObject({
      adjustments: [],
      totalDiscount: 0,
    });
    expect(
      mutationPersistence.outbox.records.map((record) => record.event.name)
    ).toEqual([
      "promotion.created",
      "promotion.redemption-recorded",
      "promotion.redemption-recorded",
    ]);
  });

  it("deduplicates promotion codes before discounting", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const service = createPromotionService({
      ...createMutationPersistence(),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["pcamp_dup", "promo_dup"]),
      repository,
    });

    const campaign = await Effect.runPromise(
      service.createCampaign({
        name: "Duplicate code campaign",
      })
    );
    await Effect.runPromise(
      service.createPromotion({
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
      })
    );

    await expect(
      Effect.runPromise(
        service.calculateAdjustments({
          cart: {
            currencyCode: "USD",
            id: "cart_dup",
            subtotal: 1000,
          },
          promotionCodes: ["SAVE10", "save10"],
        })
      )
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

  it("rejects customer-scoped usage limits until customer enforcement exists", async () => {
    const repository = createResettableInMemoryPromotionRepository();
    const service = createPromotionService({
      ...createMutationPersistence(),
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["pcamp_scope", "promo_scope"]),
      repository,
    });

    const campaign = await Effect.runPromise(
      service.createCampaign({
        name: "Scope campaign",
      })
    );
    const promotion = await Effect.runPromise(
      service.createPromotion({
        applicationMethod: {
          allocation: "cart",
          target: "subtotal",
          type: "fixed",
          value: 100,
        },
        campaignId: campaign.id,
        code: "SCOPE100",
        status: "active",
        title: "Scope discount",
      })
    );

    await expect(
      Effect.runPromise(
        service
          .createUsageLimit({
            limit: 2,
            promotionId: promotion.id,
            scope: "customer",
          })
          .pipe(Effect.flip)
      )
    ).resolves.toBeInstanceOf(PromotionUnsupportedUsageLimitScope);
  });
});
