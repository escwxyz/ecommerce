import { describe, expect, it } from "bun:test";

import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit } from "effect";

import { createInMemoryPricingRepository } from "../repositories";
import { createPricingService } from "../services";

describe("pricing Effect service", () => {
  it("calculates traceable rule-based prices without opening a transaction", async () => {
    const repository = createInMemoryPricingRepository();
    const outbox = createInMemoryOutbox({
      recordIds: ["outbox_1", "outbox_2", "outbox_3"],
    });
    const service = createPricingService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "pset_hat",
        "evt_price_set",
        "plist_vip",
        "prule_vip",
        "amt_base",
        "amt_vip",
      ]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
        transactionIds: [
          "tx_1",
          "tx_2",
          "tx_3",
          "tx_4",
          "tx_5",
          "tx_6",
          "tx_7",
        ],
      }),
    });

    const priceSet = await Effect.runPromise(
      service.createPriceSet({ title: "Hat prices" })
    );
    const priceList = await Effect.runPromise(
      service.createPriceList({
        status: "active",
        title: "VIP",
      })
    );
    await Effect.runPromise(
      service.createPriceRule({
        attribute: "customerGroupId",
        priceListId: priceList.id,
        value: "vip",
      })
    );

    const baseAmount = await Effect.runPromise(
      service.createMoneyAmount({
        amount: 3000,
        currencyCode: "usd",
        priceSetId: priceSet.id,
      })
    );
    const vipAmount = await Effect.runPromise(
      service.createMoneyAmount({
        amount: 2500,
        currencyCode: "usd",
        priceListId: priceList.id,
        priceSetId: priceSet.id,
        rules: {
          customerGroupId: "vip",
        },
      })
    );
    const calculationService = createPricingService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([]),
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        failBegin: true,
        resources: [outbox],
      }),
    });

    const calculatedPrice = await Effect.runPromise(
      calculationService.calculatePrice({
        context: {
          customerGroupId: "vip",
          regionId: "reg_us",
        },
        currencyCode: "USD",
        priceSetId: priceSet.id,
        quantity: 2,
      })
    );

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

    const fallbackPrice = await Effect.runPromise(
      calculationService.calculatePrice({
        context: {
          customerGroupId: "guest",
          regionId: "reg_us",
        },
        currencyCode: "USD",
        priceSetId: priceSet.id,
        quantity: 1,
      })
    );

    expect(fallbackPrice).toMatchObject({
      amount: 3000,
      currencyCode: "USD",
      trace: {
        moneyAmountId: baseAmount.id,
        priceListId: null,
        source: "base",
      },
    });
    expect(outbox.records.map((record) => record.event.name)).toEqual([
      "pricing.price-set-created",
    ]);
  });

  it("returns typed failures for duplicate currencies and missing prices", async () => {
    const outbox = createInMemoryOutbox();
    const service = createPricingService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "cur_usd",
        "cur_usd_duplicate",
        "pset_empty",
        "evt_empty",
      ]),
      outboxWriter: outbox.writer,
      repository: createInMemoryPricingRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });

    await Effect.runPromise(
      service.createCurrency({
        code: "usd",
        name: "US Dollar",
      })
    );

    const duplicateCurrencyExit = await Effect.runPromiseExit(
      service.createCurrency({
        code: "USD",
        name: "Duplicate US Dollar",
      })
    );
    const priceSet = await Effect.runPromise(
      service.createPriceSet({ title: "Empty prices" })
    );
    const missingPriceExit = await Effect.runPromiseExit(
      service.calculatePrice({
        currencyCode: "USD",
        priceSetId: priceSet.id,
      })
    );

    expect(Exit.isFailure(duplicateCurrencyExit)).toBe(true);
    expect(JSON.stringify(duplicateCurrencyExit.toJSON())).toContain(
      "PricingCurrencyConflict"
    );
    expect(Exit.isFailure(missingPriceExit)).toBe(true);
    expect(JSON.stringify(missingPriceExit.toJSON())).toContain(
      "PricingNoMatchingPrice"
    );
  });
});
