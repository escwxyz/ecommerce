import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";

import { taxContractRouter } from "../contracts";
import { createTaxLineId, createTaxRateId, createTaxRegionId } from "../domain";
import { taxExtensionPoints, taxModule } from "../module";
import { manualTaxProvider } from "../providers";
import { createResettableInMemoryTaxRepository } from "../repositories";
import { createTaxRouteFragment } from "../router";
import { createTaxService } from "../services";

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

describe("tax module foundation", () => {
  it("declares service, owned data, events, permissions, and extension points", () => {
    expect(taxModule.key).toBe("tax");
    expect(taxModule.providedServices?.map(({ key }) => key)).toEqual([
      "tax-service",
    ]);
    expect(taxModule.contributions?.eventTypes).toEqual([
      "tax.category-created",
      "tax.provider-configured",
      "tax.region-created",
      "tax.rate-created",
      "tax.calculated",
    ]);
    expect(taxModule.schema?.tables).toEqual([
      "tax_category",
      "tax_provider_config",
      "tax_region",
      "tax_rate",
      "tax_calculation_policy",
    ]);
    expect(taxExtensionPoints.providerCalculators).toBe(
      "tax.provider-calculators"
    );
  });

  it("calculates tax lines from provider-backed configuration without owning region policy", async () => {
    const repository = createResettableInMemoryTaxRepository();
    const eventCollector = createEventCollector();
    const service = createTaxService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: eventCollector.publisher,
      idGenerator: createSequenceIdGenerator([
        "txprov_manual",
        "evt_provider",
        "txcat_standard",
        "evt_category",
        "txreg_us",
        "evt_region",
        "txrate_us_standard",
        "evt_rate",
        "txline_item_1",
        "txcalc_cart_1",
        "evt_calculated",
      ]),
      repository,
    });

    const providerConfig = await service.createProviderConfig({
      providerKey: "manual",
      settings: {},
    });
    const category = await service.createCategory({
      code: "standard",
      name: "Standard",
    });
    const region = await service.createRegion({
      code: "us-default",
      countryCode: "us",
      name: "United States tax",
      providerConfigId: providerConfig.id,
    });
    await service.createRate({
      categoryId: category.id,
      name: "US standard",
      percentage: 8.25,
      regionId: region.id,
    });

    const result = await service.calculateTax({
      address: {
        countryCode: "US",
        postalCode: "94105",
      },
      currencyCode: "usd",
      items: [
        {
          adjustmentsTotal: -500,
          id: "cart_line_1",
          quantity: 1,
          subtotal: 10_000,
          taxCategoryId: category.id,
        },
      ],
      policy: {
        pricesIncludeTax: false,
        roundAt: "line",
      },
      regionId: region.id,
    });

    expect(result).toMatchObject({
      currencyCode: "USD",
      id: "txcalc_cart_1",
      lines: [
        {
          amount: 784,
          currencyCode: "USD",
          id: "txline_item_1",
          itemId: "cart_line_1",
          rate: 8.25,
          rateId: "txrate_us_standard",
          taxableAmount: 9500,
        },
      ],
      providerKey: "manual",
      regionId: "txreg_us",
      totalTax: 784,
    });
    expect(result).not.toHaveProperty("currency");
    expect(result).not.toHaveProperty("marketId");
    expect(result).not.toHaveProperty("salesChannelId");
    expect(eventCollector.events.map((event) => event.name)).toEqual([
      "tax.provider-configured",
      "tax.category-created",
      "tax.region-created",
      "tax.rate-created",
      "tax.calculated",
    ]);
  });

  it("uses replaceable provider contracts for calculation", async () => {
    const repository = createResettableInMemoryTaxRepository();
    const service = createTaxService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "txprov_custom",
        "txreg_custom",
        "txcalc_custom",
      ]),
      providers: [
        {
          calculateTax: (_input, context) =>
            Promise.resolve({
              currencyCode: context.currencyCode,
              lines: [],
              totalTax: 123,
            }),
          key: "custom",
          validateConfig: async (settings) => {
            if (settings.enabled !== true) {
              throw new Error("Custom provider must be enabled.");
            }
          },
        },
      ],
      repository,
    });

    const providerConfig = await service.createProviderConfig({
      providerKey: "custom",
      settings: { enabled: true },
    });
    const region = await service.createRegion({
      code: "custom",
      countryCode: "gb",
      name: "Custom provider region",
      providerConfigId: providerConfig.id,
    });

    await expect(
      service.calculateTax({
        address: {
          countryCode: "GB",
        },
        currencyCode: "gbp",
        items: [
          {
            id: "line",
            quantity: 1,
            subtotal: 1000,
          },
        ],
        policy: {
          pricesIncludeTax: false,
          roundAt: "line",
        },
        regionId: region.id,
      })
    ).resolves.toMatchObject({
      providerKey: "custom",
      totalTax: 123,
    });
  });

  it("extracts tax from inclusive prices instead of adding exclusive tax", async () => {
    const result = await manualTaxProvider.calculateTax(
      {
        address: {
          countryCode: "US",
        },
        currencyCode: "USD",
        items: [
          {
            id: "line_inclusive",
            quantity: 1,
            subtotal: 1000,
          },
        ],
        policy: {
          pricesIncludeTax: true,
          roundAt: "line",
        },
        regionId: createTaxRegionId("txreg_inclusive"),
      },
      {
        createLineId: () => createTaxLineId("txline_inclusive"),
        currencyCode: "USD",
        rates: [
          {
            categoryId: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            id: createTaxRateId("txrate_inclusive"),
            metadata: {},
            name: "Inclusive",
            percentage: 10,
            regionId: createTaxRegionId("txreg_inclusive"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }
    );

    expect(result.lines).toEqual([
      {
        amount: 91,
        currencyCode: "USD",
        id: createTaxLineId("txline_inclusive"),
        itemId: "line_inclusive",
        rate: 10,
        rateId: createTaxRateId("txrate_inclusive"),
        taxableAmount: 1000,
      },
    ]);
    expect(result.totalTax).toBe(91);
  });

  it("rounds tax at the total level when requested", async () => {
    let lineCounter = 0;
    const result = await manualTaxProvider.calculateTax(
      {
        address: {
          countryCode: "US",
        },
        currencyCode: "USD",
        items: [
          {
            id: "line_one",
            quantity: 1,
            subtotal: 33,
          },
          {
            id: "line_two",
            quantity: 1,
            subtotal: 33,
          },
        ],
        policy: {
          pricesIncludeTax: false,
          roundAt: "total",
        },
        regionId: createTaxRegionId("txreg_total"),
      },
      {
        createLineId: () => {
          lineCounter += 1;
          return createTaxLineId(
            lineCounter === 1 ? "txline_total_1" : "txline_total_2"
          );
        },
        currencyCode: "USD",
        rates: [
          {
            categoryId: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            id: createTaxRateId("txrate_total"),
            metadata: {},
            name: "Total rounding",
            percentage: 10,
            regionId: createTaxRegionId("txreg_total"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }
    );

    expect(result.lines.map((line) => line.amount)).toEqual([4, 3]);
    expect(result.totalTax).toBe(7);
  });

  it("exposes validated route contracts and admin-facing router handlers", async () => {
    const repository = createResettableInMemoryTaxRepository();
    const fragment = createTaxRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["txprov_route"]),
      repository,
    });

    const provider = await call(
      fragment.router.taxProviderConfigCreate,
      {
        providerKey: "manual",
      },
      createAllowedContext()
    );

    expect(provider).toMatchObject({
      id: "txprov_route",
      providerKey: "manual",
    });
    expect(taxContractRouter.taxCalculate["~orpc"].inputSchema).toBeDefined();
    expect(taxContractRouter.taxCalculate["~orpc"].outputSchema).toBeDefined();
  });
});
