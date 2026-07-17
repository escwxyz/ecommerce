import { describe, expect, it } from "bun:test";

import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { call } from "@orpc/server";
import { Effect } from "effect";

import { storeContractRouter } from "../contracts";
import { storeModule } from "../module";
import {
  createInMemoryStoreRepository,
  createStoreLegacyRepositoryFromRepository,
} from "../repositories";
import { createStoreRouteFragment } from "../router";
import { STORE_SETTINGS_UPDATED_EVENT, createStoreService } from "../services";

const createAllowedContext = () =>
  ({
    context: {
      auth: {
        api: {
          getSession: async () => null,
        },
        handler: () => new Response("unused"),
      } as never,
      authorization: {
        evaluatePermission: () => ({ allowed: true as const }),
      },
      session: {
        user: {
          email: "ada@example.com",
          id: "user_1",
          name: "Ada",
        },
      },
    },
  }) as const;

describe("store module foundation", () => {
  it("creates defaults and updates store settings through the service contract", async () => {
    const collector = createEventCollector();
    const service = createStoreService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      eventPublisher: collector.publisher,
      idGenerator: createSequenceIdGenerator(["store_1", "evt_1"]),
      repository: createInMemoryStoreRepository(),
    });

    await expect(
      Effect.runPromise(service.getStoreDefaults)
    ).resolves.toMatchObject({
      defaultCurrencyCode: "USD",
      defaultLocale: "en-US",
      supportedCurrencyCodes: ["USD"],
      timezone: "UTC",
    });

    await expect(
      Effect.runPromise(
        service.updateStoreSettings({
          defaultCurrencyCode: "EUR",
          name: "EU Store",
          supportedCurrencyCodes: ["usd", "eur"],
          timezone: "Europe/Berlin",
        })
      )
    ).resolves.toMatchObject({
      defaultCurrencyCode: "EUR",
      name: "EU Store",
      supportedCurrencyCodes: ["USD", "EUR"],
      timezone: "Europe/Berlin",
    });

    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      name: STORE_SETTINGS_UPDATED_EVENT,
      sourceModule: "store",
      subject: {
        id: "store_1",
        type: "store",
      },
    });
  });

  it("rejects a default currency outside the supported currency list", async () => {
    const service = createStoreService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["store_1"]),
      repository: createInMemoryStoreRepository(),
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

  it("declares contract-first store route metadata", () => {
    expect(storeContractRouter.storeSettingsUpdate["~orpc"].route.method).toBe(
      "PATCH"
    );
    expect(storeContractRouter.storeDefaultsGet["~orpc"].route.summary).toBe(
      "Get store defaults"
    );
    expect(storeContractRouter.storeSettingsGet["~orpc"].route.tags).toEqual([
      "Store",
    ]);
  });

  it("exposes typed module contributions", () => {
    expect(storeModule.key).toBe("store");
    expect(storeModule.dependencies).toEqual([]);
    expect(storeModule.contributions?.apiFragments?.[0]?.key).toBe(
      "module:store"
    );
    expect(storeModule.contributions?.adminSurfaces?.[0]?.label).toBe("Store");
    expect(storeModule.contributions?.eventTypes).toContain(
      STORE_SETTINGS_UPDATED_EVENT
    );
  });

  it("builds a route fragment from injected store dependencies", async () => {
    const fragment = createStoreRouteFragment({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator(["store_7", "evt_7"]),
      repository: createStoreLegacyRepositoryFromRepository(
        createInMemoryStoreRepository()
      ),
    });

    const settings = await call(
      fragment.router.storeSettingsUpdate,
      {
        defaultCurrencyCode: "EUR",
        name: "Module Store",
        supportedCurrencyCodes: ["USD", "EUR"],
      },
      createAllowedContext()
    );

    expect(settings).toMatchObject({
      defaultCurrencyCode: "EUR",
      id: "store_7",
      name: "Module Store",
    });

    await expect(
      call(fragment.router.storeDefaultsGet, undefined, createAllowedContext())
    ).resolves.toMatchObject({
      defaultCurrencyCode: "EUR",
      supportedCurrencyCodes: ["USD", "EUR"],
    });
  });
});
