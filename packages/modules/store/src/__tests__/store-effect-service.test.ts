import { describe, expect, it } from "bun:test";

import {
  clockLayer,
  eventPublisherLayer,
  idGeneratorLayer,
} from "@ecommerce/core";
import {
  createEventCollector,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import { createInMemoryStoreRepositoryLayer } from "../repositories";
import {
  STORE_SETTINGS_UPDATED_EVENT,
  StoreService,
  createStoreServiceFromDependenciesLayer,
} from "../services";

describe("store Effect service and Layer boundary", () => {
  it("composes store dependencies through Layers", async () => {
    const collector = createEventCollector();
    const dependencies = Layer.mergeAll(
      clockLayer(createStaticClock(new Date("2026-01-01T00:00:00.000Z"))),
      eventPublisherLayer(collector.publisher),
      idGeneratorLayer(createSequenceIdGenerator(["store_layer", "evt_layer"])),
      createInMemoryStoreRepositoryLayer()
    );
    const serviceLayer = createStoreServiceFromDependenciesLayer().pipe(
      Layer.provide(dependencies)
    );
    const program = StoreService.use((service) =>
      Effect.gen(function* () {
        const defaults = yield* service.getStoreDefaults;
        const updated = yield* service.updateStoreSettings({
          defaultCurrencyCode: "EUR",
          supportedCurrencyCodes: ["USD", "EUR"],
        });

        return { defaults, updated };
      })
    );

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(serviceLayer))
    );

    expect(result.defaults).toMatchObject({
      defaultCurrencyCode: "USD",
      supportedCurrencyCodes: ["USD"],
    });
    expect(result.updated).toMatchObject({
      defaultCurrencyCode: "EUR",
      id: "store_layer",
      supportedCurrencyCodes: ["USD", "EUR"],
    });
    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      id: "evt_layer",
      name: STORE_SETTINGS_UPDATED_EVENT,
    });
  });
});
