import { describe, expect, it } from "bun:test";

import { CurrentTransactionService } from "@ecommerce/core";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect, Exit, Option } from "effect";

import {
  createFulfillmentProviderFromPromiseProvider,
  createFulfillmentProviderRegistry,
  defineFulfillmentProvider,
} from "../providers";
import { createResettableInMemoryFulfillmentRepository } from "../repositories";
import { createFulfillmentService } from "../services";
import { createFakeFulfillmentProvider } from "../testing";

const createShippingOptionFixture = async (
  service: ReturnType<typeof createFulfillmentService>
) => {
  await Effect.runPromise(service.registerProvider("fake"));
  const fulfillmentSet = await Effect.runPromise(
    service.createFulfillmentSet({ name: "Default fulfillment set" })
  );
  const profile = await Effect.runPromise(
    service.createShippingProfile({
      fulfillmentSetId: fulfillmentSet.id,
      name: "Default shipping profile",
    })
  );
  const zone = await Effect.runPromise(
    service.createServiceZone({
      countryCodes: ["us"],
      fulfillmentSetId: fulfillmentSet.id,
      name: "US",
    })
  );

  return Effect.runPromise(
    service.createShippingOption({
      currencyCode: "usd",
      fulfillmentSetId: fulfillmentSet.id,
      name: "Ground",
      priceAmount: 500,
      profileId: profile.id,
      providerKey: "fake",
      providerServiceId: "ground",
      serviceZoneId: zone.id,
    })
  );
};

describe("fulfillment Effect service", () => {
  it("runs shipping option, fulfillment, tracking, and cancel operations through a fake provider", async () => {
    const provider = createFakeFulfillmentProvider();
    const outbox = createInMemoryOutbox();
    const service = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "fulfprov_fake",
        "fset_default",
        "shprof_default",
        "fzone_us",
        "shipopt_ground",
        "fulf_order_1",
        "ship_order_1",
      ]),
      outboxWriter: outbox.writer,
      providerRegistry: createFulfillmentProviderRegistry([provider]),
      repository: createResettableInMemoryFulfillmentRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });
    const shippingOption = await createShippingOptionFixture(service);
    const options = await Effect.runPromise(
      service.listShippingOptions({ countryCode: "US" })
    );
    const rate = await Effect.runPromise(
      service.rateShippingOption(shippingOption.id)
    );
    const detail = await Effect.runPromise(
      service.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_1",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_1",
        shippingOptionId: shippingOption.id,
      })
    );

    if (!detail.fulfillment.providerFulfillmentId) {
      throw new Error("Expected provider fulfillment ID.");
    }

    provider.setShipment(detail.fulfillment.providerFulfillmentId, {
      carrier: "Fake Carrier",
      providerShipmentId: "fake_shipment_delivered",
      status: "delivered",
      trackingNumber: "TRACK-order_1",
      trackingUrl: "https://fulfillment.example/fake/track/order_1",
    });

    const duplicate = await Effect.runPromise(
      service.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_1",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_1",
        shippingOptionId: shippingOption.id,
      })
    );
    const tracked = await Effect.runPromise(
      service.trackShipment({ fulfillmentId: detail.fulfillment.id })
    );
    const canceled = await Effect.runPromise(
      service.cancelFulfillment({
        fulfillmentId: detail.fulfillment.id,
        reason: "customer-request",
      })
    );

    expect(options).toHaveLength(1);
    expect(rate.amount).toBe(500);
    expect(detail.fulfillment.status).toBe("shipped");
    expect(detail.shipments[0]?.trackingNumber).toBe("TRACK-order_1");
    expect(duplicate.fulfillment.id).toBe(detail.fulfillment.id);
    expect(tracked?.status).toBe("delivered");
    expect(canceled.status).toBe("canceled");
    expect(outbox.records.map((record) => record.event.name)).toEqual([
      "fulfillment.set-created",
      "fulfillment.shipping-option-created",
      "fulfillment.created",
      "fulfillment.shipment-tracked",
      "fulfillment.canceled",
    ]);
  });

  it("retries provider cancellation idempotently outside the local transaction", async () => {
    const repository = createResettableInMemoryFulfillmentRepository();
    const outbox = createInMemoryOutbox();
    const fakeProvider = createFakeFulfillmentProvider();
    const providerCancellationKeys: string[] = [];
    let providerCancellationSideEffects = 0;
    let providerObservedTransaction = false;
    const completedProviderCancellations = new Set<string>();
    const provider = defineFulfillmentProvider({
      ...fakeProvider,
      cancelFulfillment: (input) =>
        Effect.gen(function* cancelFulfillmentProviderEffect() {
          const currentTransaction = yield* Effect.serviceOption(
            CurrentTransactionService
          );
          providerObservedTransaction ||= Option.isSome(currentTransaction);
          providerCancellationKeys.push(input.idempotencyKey);

          if (completedProviderCancellations.has(input.idempotencyKey)) {
            return;
          }

          completedProviderCancellations.add(input.idempotencyKey);
          providerCancellationSideEffects += 1;
          return yield* fakeProvider.cancelFulfillment(input);
        }),
    });
    const providerRegistry = createFulfillmentProviderRegistry([provider]);
    const setupService = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "fulfprov_fake",
        "fset_default",
        "shprof_default",
        "fzone_us",
        "shipopt_ground",
        "fulf_order_1",
        "ship_order_1",
      ]),
      outboxWriter: outbox.writer,
      providerRegistry,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [repository, outbox],
      }),
    });
    const shippingOption = await createShippingOptionFixture(setupService);
    const detail = await Effect.runPromise(
      setupService.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_1",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_1",
        shippingOptionId: shippingOption.id,
      })
    );
    const outboxRecordCountBeforeCancellation = outbox.records.length;
    let failingServiceTransactionCount = 0;
    const commandTransactionBoundary = createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    });
    const failedFinalTransactionBoundary = createInMemoryTransactionBoundary({
      failCommit: true,
      resources: [repository, outbox],
    });
    const failingService = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:01.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_cancel_failed"]),
      outboxWriter: outbox.writer,
      providerRegistry,
      repository,
      transactionBoundary: {
        withTransaction: (effect) => {
          failingServiceTransactionCount += 1;
          return failingServiceTransactionCount === 1
            ? commandTransactionBoundary.withTransaction(effect)
            : failedFinalTransactionBoundary.withTransaction(effect);
        },
      },
    });

    const failedCancellation = await Effect.runPromiseExit(
      failingService.cancelFulfillment({
        fulfillmentId: detail.fulfillment.id,
        reason: "customer-request",
      })
    );
    const [rolledBackFulfillment] = await Effect.runPromise(
      failingService.listFulfillments
    );

    expect(Exit.isFailure(failedCancellation)).toBe(true);
    expect(rolledBackFulfillment?.status).toBe("shipped");
    expect(outbox.records).toHaveLength(outboxRecordCountBeforeCancellation);

    const retryService = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:02.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_cancel_retry"]),
      outboxWriter: outbox.writer,
      providerRegistry,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [repository, outbox],
      }),
    });
    const canceled = await Effect.runPromise(
      retryService.cancelFulfillment({
        fulfillmentId: detail.fulfillment.id,
        reason: "customer-request",
      })
    );

    expect(canceled.status).toBe("canceled");
    expect(providerObservedTransaction).toBe(false);
    expect(providerCancellationKeys).toEqual([
      `fulfillment.cancel:${detail.fulfillment.id}`,
      `fulfillment.cancel:${detail.fulfillment.id}`,
    ]);
    expect(providerCancellationSideEffects).toBe(1);
    expect(outbox.records.at(-1)?.event.name).toBe("fulfillment.canceled");
  });

  it("times out promise-backed provider cancellation instead of waiting indefinitely", async () => {
    const provider = createFulfillmentProviderFromPromiseProvider({
      cancelFulfillment: () => new Promise<void>(() => undefined),
      createFulfillment: async () => ({
        providerFulfillmentId: "provider_fulfillment_timeout",
        status: "created",
      }),
      id: "fake",
      rate: async (input) => ({
        amount: { amount: 500, currencyCode: "USD" },
        providerKey: "fake",
        providerServiceId: input.providerServiceId,
      }),
      trackShipment: async () => null,
      validateOption: async () => ({ valid: true }),
    });
    const outbox = createInMemoryOutbox();
    const service = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "fulfprov_fake",
        "fset_default",
        "shprof_default",
        "fzone_us",
        "shipopt_ground",
        "fulf_order_timeout",
      ]),
      outboxWriter: outbox.writer,
      providerCancellationTimeoutMs: 5,
      providerRegistry: createFulfillmentProviderRegistry([provider]),
      repository: createResettableInMemoryFulfillmentRepository(),
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [outbox],
      }),
    });
    const shippingOption = await createShippingOptionFixture(service);
    const detail = await Effect.runPromise(
      service.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_timeout",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_timeout",
        shippingOptionId: shippingOption.id,
      })
    );

    const timedCancellation = await Effect.runPromiseExit(
      service
        .cancelFulfillment({
          fulfillmentId: detail.fulfillment.id,
          reason: "timeout-test",
        })
        .pipe(
          Effect.timeoutOrElse({
            duration: "100 millis",
            orElse: () => Effect.fail(new Error("test timed out")),
          })
        )
    );

    expect(Exit.isFailure(timedCancellation)).toBe(true);
    expect(String(timedCancellation)).toContain(
      "Fulfillment provider cancellation timed out"
    );
  });

  it("persists a cancellation command before provider cancellation for reconciliation", async () => {
    const repository = createResettableInMemoryFulfillmentRepository();
    const outbox = createInMemoryOutbox();
    const fakeProvider = createFakeFulfillmentProvider();
    const provider = defineFulfillmentProvider({
      ...fakeProvider,
      cancelFulfillment: (input) => fakeProvider.cancelFulfillment(input),
    });
    const providerRegistry = createFulfillmentProviderRegistry([provider]);
    const setupService = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
      idGenerator: createSequenceIdGenerator([
        "fulfprov_fake",
        "fset_default",
        "shprof_default",
        "fzone_us",
        "shipopt_ground",
        "fulf_order_reconcile",
        "ship_order_reconcile",
      ]),
      outboxWriter: outbox.writer,
      providerRegistry,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [repository, outbox],
      }),
    });
    const shippingOption = await createShippingOptionFixture(setupService);
    const detail = await Effect.runPromise(
      setupService.createFulfillment({
        address: { countryCode: "US" },
        idempotencyKey: "fulfillment_reconcile",
        items: [{ lineItemId: "line_1", quantity: 1, sku: "SKU-1" }],
        orderId: "order_reconcile",
        shippingOptionId: shippingOption.id,
      })
    );
    let transactionCount = 0;
    const committingBoundary = createInMemoryTransactionBoundary({
      resources: [repository, outbox],
    });
    const failingBoundary = createInMemoryTransactionBoundary({
      failCommit: true,
      resources: [repository, outbox],
    });
    const service = createFulfillmentService({
      clock: createStaticClock(new Date("2026-01-01T00:00:01.000Z")),
      idGenerator: createSequenceIdGenerator(["evt_cancel_failed"]),
      outboxWriter: outbox.writer,
      providerRegistry,
      repository,
      transactionBoundary: {
        withTransaction: (effect) => {
          transactionCount += 1;
          return transactionCount === 1
            ? committingBoundary.withTransaction(effect)
            : failingBoundary.withTransaction(effect);
        },
      },
    });

    const failedCancellation = await Effect.runPromiseExit(
      service.cancelFulfillment({
        fulfillmentId: detail.fulfillment.id,
        reason: "customer-request",
      })
    );
    const stored = await Effect.runPromise(
      repository.findFulfillmentById(detail.fulfillment.id)
    );
    const idempotencyKey = `fulfillment.cancel:${detail.fulfillment.id}`;

    expect(Exit.isFailure(failedCancellation)).toBe(true);
    expect(stored?.status).toBe("shipped");
    expect(stored?.metadata).toMatchObject({
      fulfillmentCancellationCommands: {
        [idempotencyKey]: {
          idempotencyKey,
          reason: "customer-request",
          status: "provider-cancellation-requested",
        },
      },
    });
  });
});
