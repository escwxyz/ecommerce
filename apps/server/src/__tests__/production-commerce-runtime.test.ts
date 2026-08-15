import { describe, expect, it } from "bun:test";

import { COMMERCE_EVENTS_OUTBOX_TOPIC } from "@ecommerce/core";
import { Effect, Layer } from "effect";

import {
  ProductionCommerceRuntimeConfigError,
  createProductionCommerceRuntimeComposition,
} from "../production-commerce-runtime";

const createBindings = () => ({
  cartCache: {} as DurableObjectNamespace,
  commerceEventQueue: {} as Queue,
  notificationEventRealtime: {} as DurableObjectNamespace,
  notificationEventQueue: {} as Queue,
  postgres: {
    connectionString:
      "postgres://commerce:secret@database.example.test:5432/commerce",
  } as Hyperdrive,
  statefulCoordinator: {} as DurableObjectNamespace,
});

describe("production commerce runtime composition", () => {
  for (const binding of [
    "cartCache",
    "commerceEventQueue",
    "notificationEventQueue",
    "notificationEventRealtime",
    "postgres",
    "statefulCoordinator",
  ] as const) {
    it(`fails closed with a typed error when ${binding} is missing`, () => {
      expect(() =>
        createProductionCommerceRuntimeComposition({
          bindings: {
            ...createBindings(),
            [binding]: undefined,
          },
          mode: "production",
        })
      ).toThrow(ProductionCommerceRuntimeConfigError);
    });
  }

  it("selects PostgreSQL and Cloudflare adapters without exposing secrets", () => {
    const composition = createProductionCommerceRuntimeComposition({
      bindings: createBindings(),
      mode: "production",
    });

    expect(Layer.isLayer(composition.applicationLayer)).toBe(true);
    expect(composition.diagnostics).toEqual({
      adapters: {
        actor: "cloudflare-durable-object",
        cartCache: "cloudflare-durable-object",
        notifications: "cloudflare-queue",
        providers: {
          fulfillment: "disabled",
          notification: "disabled",
          payment: "disabled",
          tax: "manual",
        },
        relational: "effect-postgres",
      },
      modules: [
        "store",
        "customer",
        "product",
        "pricing",
        "inventory",
        "cart",
        "region-sales-channel",
        "promotion",
        "tax",
        "fulfillment",
        "payment",
        "order",
        "notification-event",
      ],
    });
    expect(JSON.stringify(composition.diagnostics)).not.toContain("secret");
  });

  it("keeps in-memory and default services out of production composition", async () => {
    const productionSource = await Bun.file(
      new URL("../production-commerce-runtime.ts", import.meta.url)
    ).text();
    const workerSource = await Bun.file(
      new URL("../index.ts", import.meta.url)
    ).text();
    const source = `${productionSource}\n${workerSource}`;

    expect(source).not.toMatch(/createInMemory\w+/);
    expect(source).not.toMatch(/default\w+(Repository|Service)/);
    expect(source).not.toMatch(/@ecommerce\/[^"\n]+\/testing/);
    expect(source).not.toContain("createCloudflareQueuedNotificationProvider");
    expect(source).not.toContain("./commerce-runtime");
  });

  it("keeps the Durable Object cart cache on reads and synchronizes it after commit", async () => {
    const productionSource = await Bun.file(
      new URL("../production-commerce-runtime.ts", import.meta.url)
    ).text();

    expect(productionSource).toContain("createCloudflareCartCacheRepository");
    expect(productionSource).toContain("createCartMutationCacheCoordinator");
    expect(productionSource).toContain("createCommittedCartCacheSynchronizer");
    expect(productionSource).toContain(
      "mutationRepository: projectionRepository"
    );
    expect(productionSource).toContain("repository: cachedRepository");
  });

  it("keeps the deleted checkout compatibility runtime deleted", async () => {
    expect(
      await Bun.file(
        new URL("../commerce-runtime.ts", import.meta.url)
      ).exists()
    ).toBe(false);
    expect(
      await Bun.file(
        new URL("../development-seed.ts", import.meta.url)
      ).exists()
    ).toBe(false);
  });

  it("requires stateful adapter choices at module construction seams", async () => {
    const serviceSources = await Promise.all(
      [
        "../../../../packages/modules/cart/src/services/cart.service.ts",
        "../../../../packages/modules/checkout/src/services/checkout.service.ts",
        "../../../../packages/modules/fulfillment/src/services/fulfillment.service.ts",
        "../../../../packages/modules/inventory/src/services/inventory.service.ts",
        "../../../../packages/modules/notification-event/src/services/notification-event.service.ts",
        "../../../../packages/modules/payment/src/services/payment.service.ts",
        "../../../../packages/modules/tax/src/services/tax.service.ts",
      ].map((path) => Bun.file(new URL(path, import.meta.url)).text())
    );
    const source = serviceSources.join("\n");

    expect(source).not.toMatch(
      /(actorService|completionStore|notificationProviders|providerRegistry|repository)\s*=\s*(create|default|empty)/
    );
    expect(source).not.toMatch(/default\w+(Repository|Service)/);
  });

  it("represents missing queue bindings explicitly in development", () => {
    const composition = createProductionCommerceRuntimeComposition({
      bindings: {
        ...createBindings(),
        notificationEventQueue: undefined,
      },
      mode: "development",
    });

    expect(composition.diagnostics.adapters.notifications).toBe("disabled");
  });

  it("drains committed commerce outbox records through the commerce queue", async () => {
    const productionSource = await Bun.file(
      new URL("../production-commerce-runtime.ts", import.meta.url)
    ).text();
    const workerSource = await Bun.file(
      new URL("../index.ts", import.meta.url)
    ).text();

    expect(productionSource).toContain("deliverOutboxBatch");
    expect(productionSource).toContain("COMMERCE_EVENTS_OUTBOX_TOPIC");
    expect(productionSource).toContain("createCloudflareQueuePublisherLayer");
    expect(workerSource).toContain("composition.drainCommerceEventOutbox()");
    expect(workerSource).toContain("composition.processCommerceEventQueue");
  });

  it("acks valid commerce events after durable handling and retries handler failures", async () => {
    const handled: string[] = [];
    const options = {
      bindings: {
        ...createBindings(),
        commerceEventQueue: undefined,
        notificationEventQueue: undefined,
      },
      commerceEventConsumer: {
        consume: (message: { readonly id: string }) => {
          handled.push(message.id);

          if (message.id === "outbox_failed") {
            throw new Error("handler unavailable");
          }
        },
      },
      mode: "development",
    } satisfies Parameters<
      typeof createProductionCommerceRuntimeComposition
    >[0];
    const composition = createProductionCommerceRuntimeComposition(options);
    let acknowledged = 0;
    let retried = 0;
    const batch = {
      messages: [
        {
          ack: () => {
            acknowledged += 1;
          },
          body: {
            correlationId: "correlation_1",
            id: "outbox_1",
            idempotencyKey: "event_1",
            payload: {},
            queueName: COMMERCE_EVENTS_OUTBOX_TOPIC,
            type: "store.settings-updated",
          },
          retry: () => {
            retried += 1;
          },
        },
        {
          ack: () => {
            acknowledged += 1;
          },
          body: {
            correlationId: "correlation_2",
            id: "outbox_failed",
            idempotencyKey: "event_2",
            payload: {},
            queueName: COMMERCE_EVENTS_OUTBOX_TOPIC,
            type: "store.settings-updated",
          },
          retry: () => {
            retried += 1;
          },
        },
      ],
    } as MessageBatch<unknown>;

    await expect(composition.processCommerceEventQueue(batch)).rejects.toThrow(
      "handler unavailable"
    );

    expect(acknowledged).toBe(1);
    expect(retried).toBe(1);
    expect(handled).toEqual(["outbox_1", "outbox_failed"]);
  });

  it("retries malformed commerce queue messages without acknowledging them", async () => {
    const options = {
      bindings: {
        ...createBindings(),
        commerceEventQueue: undefined,
        notificationEventQueue: undefined,
      },
      commerceEventConsumer: {
        consume: () => {
          throw new Error("invalid payloads must not reach handlers");
        },
      },
      mode: "development",
    } satisfies Parameters<
      typeof createProductionCommerceRuntimeComposition
    >[0];
    const composition = createProductionCommerceRuntimeComposition(options);
    let acknowledged = 0;
    let retried = 0;
    const batch = {
      messages: [
        {
          ack: () => {
            acknowledged += 1;
          },
          body: {
            id: "invalid",
            queueName: "wrong-topic",
          },
          retry: () => {
            retried += 1;
          },
        },
      ],
    } as MessageBatch<unknown>;

    await composition.processCommerceEventQueue(batch);

    expect(acknowledged).toBe(0);
    expect(retried).toBe(1);
  });

  it("rejects a missing or invalid runtime mode", () => {
    expect(() =>
      createProductionCommerceRuntimeComposition({
        bindings: createBindings(),
        mode: undefined as unknown as "production",
      })
    ).toThrow(ProductionCommerceRuntimeConfigError);
  });

  it("rejects malformed PostgreSQL configuration before Layer construction", () => {
    expect(() =>
      createProductionCommerceRuntimeComposition({
        bindings: {
          ...createBindings(),
          postgres: { connectionString: "not-a-postgres-url" } as Hyperdrive,
        },
        mode: "production",
      })
    ).toThrow(ProductionCommerceRuntimeConfigError);
  });
});
