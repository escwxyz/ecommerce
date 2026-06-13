import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { pricingContractRouter } from "../contracts";
import { pricingModule } from "../module";
import { createResettableInMemoryPricingRepository } from "../repositories";
import { createPricingRouteFragment } from "../router";
import { createPricingService } from "../services";

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

describe("pricing module foundation", () => {
  it("declares service, events, permissions, and extension points", () => {
    expect(pricingModule.key).toBe("pricing");
    expect(pricingModule.providedServices?.map(({ key }) => key)).toEqual([
      "pricing-service",
    ]);
    expect(pricingModule.contributions?.eventTypes).toEqual([
      "pricing.price-set-created",
      "pricing.price-calculated",
    ]);
  });

  it("calculates traceable rule-based prices without discounts or tax", async () => {
    const repository = createResettableInMemoryPricingRepository();
    const eventCollector = createEventCollector();
    const service = createPricingService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "pset_hat",
        "evt_price_set",
        "plist_vip",
        "amt_base",
        "amt_vip",
        "evt_calculated",
      ]),
      repository,
    });

    const priceSet = await service.createPriceSet({ title: "Hat prices" });
    const priceList = await service.createPriceList({
      status: "active",
      title: "VIP",
    });
    await service.createPriceRule({
      attribute: "customerGroupId",
      priceListId: priceList.id,
      value: "vip",
    });

    const baseAmount = await service.createMoneyAmount({
      amount: 3000,
      currencyCode: "usd",
      priceSetId: priceSet.id,
    });
    const vipAmount = await service.createMoneyAmount({
      amount: 2500,
      currencyCode: "usd",
      priceListId: priceList.id,
      priceSetId: priceSet.id,
      rules: {
        customerGroupId: "vip",
      },
    });

    const calculatedPrice = await service.calculatePrice({
      context: {
        customerGroupId: "vip",
        regionId: "reg_us",
      },
      currencyCode: "USD",
      priceSetId: priceSet.id,
      quantity: 2,
    });

    expect(calculatedPrice).toMatchObject({
      amount: 2500,
      currencyCode: "USD",
      priceSetId: "pset_hat",
      quantity: 2,
      subtotal: 5000,
      trace: {
        moneyAmountId: vipAmount.id,
        priceListId: "plist_vip",
        ruleMatches: ["customerGroupId:vip"],
        source: "price-list",
      },
    });

    const fallbackPrice = await service.calculatePrice({
      context: {
        customerGroupId: "guest",
        regionId: "reg_us",
      },
      currencyCode: "USD",
      priceSetId: priceSet.id,
      quantity: 1,
    });

    expect(fallbackPrice).toMatchObject({
      amount: 3000,
      currencyCode: "USD",
      trace: {
        moneyAmountId: baseAmount.id,
        priceListId: null,
        source: "base",
      },
    });
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "pricing.price-set-created",
      "pricing.price-calculated",
      "pricing.price-calculated",
    ]);
  });

  it("declares contract-first route metadata", () => {
    expect(pricingContractRouter.pricingCalculate["~orpc"].route.tags).toEqual([
      "Pricing",
    ]);
  });

  it("builds route fragments with injected repositories", async () => {
    const repository = createResettableInMemoryPricingRepository();
    const fragment = createPricingRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cur_usd",
        "pset_route",
        "evt_price_set",
        "amt_route",
        "evt_calculated",
      ]),
      repository,
    });
    const context = createAllowedContext();

    await expect(
      call(
        fragment.router.pricingCurrencyCreate,
        {
          code: "usd",
          name: "US Dollar",
        },
        context
      )
    ).resolves.toMatchObject({
      code: "USD",
      id: "cur_usd",
    });

    const priceSet = await call(
      fragment.router.pricingPriceSetCreate,
      {
        title: "Route prices",
      },
      context
    );

    await call(
      fragment.router.pricingMoneyAmountCreate,
      {
        amount: 1900,
        currencyCode: "USD",
        priceSetId: priceSet.id,
      },
      context
    );

    await expect(
      call(
        fragment.router.pricingCalculate,
        {
          currencyCode: "USD",
          priceSetId: priceSet.id,
        },
        context
      )
    ).resolves.toMatchObject({
      amount: 1900,
      subtotal: 1900,
      trace: {
        source: "base",
      },
    });
  });
});
