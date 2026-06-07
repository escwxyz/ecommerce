import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { regionSalesChannelContractRouter } from "../contracts";
import { regionSalesChannelModule } from "../module";
import { createResettableInMemoryRegionSalesChannelRepository } from "../repositories";
import { createRegionSalesChannelRouteFragment } from "../router";
import { createRegionService, createSalesChannelService } from "../services";

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

describe("region sales-channel module foundation", () => {
  it("keeps region and sales-channel service contracts distinct", () => {
    expect(regionSalesChannelModule.key).toBe("region-sales-channel");
    expect(
      regionSalesChannelModule.providedServices?.map(({ key }) => key)
    ).toEqual(["region-service", "sales-channel-service"]);
    expect(regionSalesChannelModule.contributions?.eventTypes).toEqual([
      "region.created",
      "sales-channel.created",
      "sales-channel.product-published",
    ]);
  });

  it("creates and validates region constraints through the region service", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const service = createRegionService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["reg_eu", "evt_1"]),
      repository,
    });

    const region = await service.createRegion({
      countries: ["de", "FR", "de"],
      currencyCode: "eur",
      fulfillmentOptionIds: ["ship_standard"],
      name: "European Union",
      paymentProviderIds: ["stripe"],
      taxProviderId: "tax_default",
    });

    expect(region).toMatchObject({
      countries: ["DE", "FR"],
      currencyCode: "EUR",
      id: "reg_eu",
    });
    await expect(
      service.validateRegionConstraints({
        countryCode: "DE",
        currencyCode: "EUR",
        paymentProviderId: "stripe",
        regionId: "reg_eu",
      })
    ).resolves.toEqual({
      allowed: true,
      reasons: [],
    });
    await expect(
      service.validateRegionConstraints({
        countryCode: "US",
        currencyCode: "USD",
        regionId: "reg_eu",
      })
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

    const channel = await service.createSalesChannel({
      name: "Web storefront",
      status: "active",
    });

    await expect(
      service.checkProductPublishability({
        productId: "prod_1",
        salesChannelId: channel.id,
      })
    ).resolves.toEqual({
      publishable: false,
      reasons: ["product-not-published-to-channel"],
    });

    await service.publishProductToSalesChannel({
      productId: "prod_1",
      salesChannelId: channel.id,
    });

    await expect(
      service.checkProductPublishability({
        productId: "prod_1",
        salesChannelId: channel.id,
      })
    ).resolves.toEqual({
      publishable: true,
      reasons: [],
    });
  });

  it("declares contract-first route metadata", () => {
    expect(
      regionSalesChannelContractRouter.regionCreate["~orpc"].route.tags
    ).toEqual(["Regions"]);
    expect(
      regionSalesChannelContractRouter.salesChannelCreate["~orpc"].route.tags
    ).toEqual(["Sales channels"]);
  });

  it("builds route fragments with injected repositories", async () => {
    const repository = createResettableInMemoryRegionSalesChannelRepository();
    const fragment = createRegionSalesChannelRouteFragment({
      region: {
        clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
        idGenerator: createSequenceIdGenerator(["reg_route", "evt_reg"]),
        repository,
      },
      salesChannel: {
        clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
        idGenerator: createSequenceIdGenerator(["sc_route", "evt_sc"]),
        repository,
      },
    });
    const context = createAllowedContext();

    await expect(
      call(
        fragment.router.regionCreate,
        {
          countries: ["US"],
          currencyCode: "USD",
          name: "United States",
        },
        context
      )
    ).resolves.toMatchObject({
      id: "reg_route",
    });

    await expect(
      call(
        fragment.router.salesChannelCreate,
        {
          name: "Web",
          status: "active",
        },
        context
      )
    ).resolves.toMatchObject({
      id: "sc_route",
    });
  });
});
