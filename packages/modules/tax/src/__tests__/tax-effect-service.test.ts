import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import {
  TaxValidationFailure,
  createTaxLineId,
  createTaxRateId,
  createTaxRegionId,
} from "../domain";
import { manualTaxProvider } from "../providers";
import { createResettableInMemoryTaxRepository } from "../repositories";
import { createTaxService } from "../services";

describe("tax Effect service", () => {
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

    const providerConfig = await Effect.runPromise(
      service.createProviderConfig({
        providerKey: "manual",
        settings: {},
      })
    );
    const category = await Effect.runPromise(
      service.createCategory({
        code: "standard",
        name: "Standard",
      })
    );
    const region = await Effect.runPromise(
      service.createRegion({
        code: "us-default",
        countryCode: "us",
        name: "United States tax",
        providerConfigId: providerConfig.id,
      })
    );
    await Effect.runPromise(
      service.createRate({
        categoryId: category.id,
        name: "US standard",
        percentage: 8.25,
        regionId: region.id,
      })
    );

    const result = await Effect.runPromise(
      service.calculateTax({
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
      })
    );

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
            Effect.succeed({
              currencyCode: context.currencyCode,
              lines: [],
              totalTax: 123,
            }),
          key: "custom",
          validateConfig: (settings) =>
            settings.enabled === true
              ? Effect.void
              : Effect.fail(
                  new TaxValidationFailure({
                    message: "Custom provider must be enabled.",
                  })
                ),
        },
      ],
      repository,
    });

    const providerConfig = await Effect.runPromise(
      service.createProviderConfig({
        providerKey: "custom",
        settings: { enabled: true },
      })
    );
    const region = await Effect.runPromise(
      service.createRegion({
        code: "custom",
        countryCode: "gb",
        name: "Custom provider region",
        providerConfigId: providerConfig.id,
      })
    );

    await expect(
      Effect.runPromise(
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
      )
    ).resolves.toMatchObject({
      providerKey: "custom",
      totalTax: 123,
    });
  });

  it("extracts tax from inclusive prices instead of adding exclusive tax", async () => {
    const result = await Effect.runPromise(
      manualTaxProvider.calculateTax(
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
      )
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
});
