import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import { createInMemoryStoreRepository } from "../repositories";
import { STORE_SETTINGS_UPDATED_EVENT, createStoreService } from "../services";
import type { CreateStoreServiceOptions } from "../services";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const createStoreTestService = ({
  clock = createStaticClock(createdAt),
  ids = ["store_regression", "event_regression"],
  ...options
}: {
  readonly clock?: ReturnType<typeof createStaticClock>;
  readonly ids?: readonly string[];
  readonly eventPublisher?: CreateStoreServiceOptions["eventPublisher"];
} = {}) => {
  const collector = createEventCollector();
  const service = createStoreService({
    clock,
    eventPublisher: options.eventPublisher ?? collector.publisher,
    idGenerator: createSequenceIdGenerator(ids),
    repository: createInMemoryStoreRepository(),
  });

  return {
    collector,
    service,
  };
};

describe("store service regression behavior", () => {
  it("lazily creates one commerce store settings record with deterministic defaults", async () => {
    const { service } = createStoreTestService({
      ids: ["store_primary"],
    });

    const settings = await Effect.runPromise(service.getStoreSettings);
    const defaults = await Effect.runPromise(service.getStoreDefaults);
    const loadedAgain = await Effect.runPromise(service.getStoreSettings);

    expect(settings).toMatchObject({
      createdAt,
      defaultCurrencyCode: "USD",
      defaultLocale: "en-US",
      defaultRegionId: null,
      defaultSalesChannelId: null,
      id: "store_primary",
      metadata: {},
      name: "Default store",
      supportedCurrencyCodes: ["USD"],
      timezone: "UTC",
      updatedAt: createdAt,
    });
    expect(defaults).toEqual({
      defaultCurrencyCode: "USD",
      defaultLocale: "en-US",
      defaultRegionId: null,
      defaultSalesChannelId: null,
      supportedCurrencyCodes: ["USD"],
      timezone: "UTC",
    });
    expect(loadedAgain).toEqual(settings);
  });

  it("normalizes store updates and publishes the changed-field event", async () => {
    const { collector, service } = createStoreTestService({
      clock: createStaticClock(updatedAt),
      ids: ["store_update", "event_update"],
    });

    const updated = await Effect.runPromise(
      service.updateStoreSettings({
        defaultCurrencyCode: "eur",
        defaultLocale: " de-DE ",
        defaultRegionId: "region_eu",
        defaultSalesChannelId: "sc_web",
        metadata: { organizationHint: "org_demo" },
        name: " EU Store ",
        supportedCurrencyCodes: ["usd", "eur", "USD", " "],
        timezone: " Europe/Berlin ",
      })
    );

    expect(updated).toMatchObject({
      defaultCurrencyCode: "EUR",
      defaultLocale: "de-DE",
      defaultRegionId: "region_eu",
      defaultSalesChannelId: "sc_web",
      id: "store_update",
      metadata: { organizationHint: "org_demo" },
      name: "EU Store",
      supportedCurrencyCodes: ["USD", "EUR"],
      timezone: "Europe/Berlin",
      updatedAt,
    });
    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      id: "event_update",
      name: STORE_SETTINGS_UPDATED_EVENT,
      payload: {
        id: "store_update",
        updatedFields: [
          "name",
          "defaultCurrencyCode",
          "supportedCurrencyCodes",
          "defaultRegionId",
          "defaultSalesChannelId",
          "defaultLocale",
          "timezone",
          "metadata",
        ],
      },
      sourceModule: "store",
      subject: {
        id: "store_update",
        type: "store",
      },
    });
  });

  it("does not publish update events when only the ignored timestamp changes", async () => {
    const { collector, service } = createStoreTestService({
      clock: createStaticClock(updatedAt),
      ids: ["store_noop", "event_noop"],
    });

    await Effect.runPromise(service.getStoreSettings);
    const unchanged = await Effect.runPromise(
      service.updateStoreSettings({
        defaultCurrencyCode: "usd",
        defaultLocale: " en-US ",
        name: " Default store ",
        supportedCurrencyCodes: ["USD"],
        timezone: " UTC ",
      })
    );

    expect(unchanged).toMatchObject({
      defaultCurrencyCode: "USD",
      defaultLocale: "en-US",
      id: "store_noop",
      name: "Default store",
      supportedCurrencyCodes: ["USD"],
      timezone: "UTC",
      updatedAt,
    });
    expect(collector.events).toEqual([]);
  });

  it("rejects updates whose default currency is not supported", async () => {
    const { service } = createStoreTestService({
      ids: ["store_invalid"],
    });

    await expect(
      Effect.runPromise(
        service.updateStoreSettings({
          defaultCurrencyCode: "EUR",
          supportedCurrencyCodes: ["USD"],
        })
      )
    ).rejects.toMatchObject({
      _tag: "StoreDefaultCurrencyUnsupported",
      defaultCurrencyCode: "EUR",
      supportedCurrencyCodes: ["USD"],
    });
  });
});
