import { describe, expect, it } from "bun:test";

import {
  clockLayer,
  composeCommerceApplication,
  idGeneratorLayer,
  outboxWriterLayer,
  transactionBoundaryLayer,
} from "@ecommerce/core";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Layer } from "effect";

import {
  FulfillmentProviderRegistryService,
  FulfillmentRepositoryService,
  FulfillmentService,
  createFulfillmentProviderRegistry,
  fulfillmentModule,
} from "../index";
import { createFakeFulfillmentProvider } from "../providers/fake-fulfillment-provider";
import { createResettableInMemoryFulfillmentRepository } from "../repositories";

describe("fulfillment module", () => {
  it("declares fulfillment metadata and omits legacy route fragments", () => {
    const { contributions } = fulfillmentModule;

    if (!contributions) {
      throw new Error("Fulfillment module contributions are required.");
    }

    expect(fulfillmentModule.key).toBe("fulfillment");
    expect(fulfillmentModule.schema).toBeUndefined();
    expect(contributions.eventTypes).toContain("fulfillment.created");
    expect(contributions.workflowSteps?.map((step) => step.name)).toEqual(
      expect.arrayContaining(["fulfillment.create", "fulfillment.cancel"])
    );
    expect(contributions.services?.map(({ key }) => key)).toEqual([
      "fulfillment:service",
    ]);
    expect(contributions).not.toHaveProperty("apiFragments");
    expect(contributions.adminSurfaces?.[0]?.label).toBe("Fulfillment");
  });

  it("uses the fulfillment provider registry supplied by host composition", async () => {
    const provider = createFakeFulfillmentProvider({ id: "host-fulfillment" });
    const outbox = createInMemoryOutbox();
    const repository = createResettableInMemoryFulfillmentRepository();
    const transactionBoundary = createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    });
    const applicationLayer = composeCommerceApplication({
      modules: [fulfillmentModule] as const,
    }).applicationLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          clockLayer(createStaticClock(new Date("2026-01-01T00:00:00.000Z"))),
          idGeneratorLayer(createSequenceIdGenerator(["fulprov_host"])),
          outboxWriterLayer(outbox.writer),
          transactionBoundaryLayer(transactionBoundary),
          Layer.succeed(
            FulfillmentProviderRegistryService,
            createFulfillmentProviderRegistry([provider])
          ),
          Layer.succeed(FulfillmentRepositoryService, repository)
        )
      )
    );

    const record = await Effect.runPromise(
      FulfillmentService.use((service) =>
        service.registerProvider(provider.id)
      ).pipe(Effect.provide(applicationLayer))
    );

    expect(record.providerRecordId).toBe(provider.id);
  });
});
