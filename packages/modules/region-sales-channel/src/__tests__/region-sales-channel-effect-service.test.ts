import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit } from "effect";

import {
  RegionSalesChannelEventPublishFailure,
  SalesChannelNotFound,
  createSalesChannelId,
} from "../domain";
import { createResettableInMemoryRegionSalesChannelRepository } from "../repositories";
import { createRegionService, createSalesChannelService } from "../services";

describe("region sales-channel Effect services", () => {
  it("creates and validates region constraints", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const service = createRegionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["reg_eu", "evt_1"]),
      repository,
    });

    const region = await Effect.runPromise(
      service.createRegion({
        countries: ["de", "FR", "de"],
        currencyCode: "eur",
        fulfillmentOptionIds: ["ship_standard"],
        name: "European Union",
        paymentProviderIds: ["stripe"],
        taxProviderId: "tax_default",
      })
    );

    expect(region).toMatchObject({
      countries: ["DE", "FR"],
      currencyCode: "EUR",
      id: "reg_eu",
    });
    await expect(
      Effect.runPromise(
        service.validateRegionConstraints({
          countryCode: "DE",
          currencyCode: "EUR",
          paymentProviderId: "stripe",
          regionId: region.id,
        })
      )
    ).resolves.toEqual({
      allowed: true,
      reasons: [],
    });
    await expect(
      Effect.runPromise(
        service.validateRegionConstraints({
          countryCode: "US",
          currencyCode: "USD",
          regionId: region.id,
        })
      )
    ).resolves.toEqual({
      allowed: false,
      reasons: ["currency-not-allowed", "country-not-allowed"],
    });
  });

  it("manages publishability through the sales-channel service", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const service = createSalesChannelService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["sc_web", "evt_1", "evt_2"]),
      repository,
    });

    const channel = await Effect.runPromise(
      service.createSalesChannel({
        name: "Web storefront",
        status: "active",
      })
    );

    await expect(
      Effect.runPromise(
        service.checkProductPublishability({
          productId: "prod_1",
          salesChannelId: channel.id,
        })
      )
    ).resolves.toEqual({
      publishable: false,
      reasons: ["product-not-published-to-channel"],
    });

    await Effect.runPromise(
      service.publishProductToSalesChannel({
        productId: "prod_1",
        salesChannelId: channel.id,
      })
    );

    await expect(
      Effect.runPromise(
        service.checkProductPublishability({
          productId: "prod_1",
          salesChannelId: channel.id,
        })
      )
    ).resolves.toEqual({
      publishable: true,
      reasons: [],
    });
  });

  it("returns typed failures for expected service errors", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const failingPublisher = {
      publish: () => Promise.reject(new Error("boom")),
    };
    const regionService = createRegionService({
      eventPublisher: failingPublisher,
      idGenerator: createSequenceIdGenerator(["reg_fail", "evt_fail"]),
      repository,
    });
    const salesChannelService = createSalesChannelService({ repository });

    const publishExit = await Effect.runPromiseExit(
      regionService.createRegion({
        countries: ["US"],
        currencyCode: "USD",
        name: "United States",
      })
    );
    const missingChannelExit = await Effect.runPromiseExit(
      salesChannelService.publishProductToSalesChannel({
        productId: "prod_1",
        salesChannelId: createSalesChannelId("sc_missing"),
      })
    );

    expect(Exit.isFailure(publishExit)).toBe(true);
    if (Exit.isFailure(publishExit)) {
      expect(publishExit.cause.toString()).toContain(
        RegionSalesChannelEventPublishFailure.name
      );
    }
    expect(Exit.isFailure(missingChannelExit)).toBe(true);
    if (Exit.isFailure(missingChannelExit)) {
      expect(missingChannelExit.cause.toString()).toContain(
        SalesChannelNotFound.name
      );
    }
  });
});
