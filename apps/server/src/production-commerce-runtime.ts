import { composeBuiltinCommerceApplication } from "@ecommerce/api";
import {
  CartRepositoryService,
  CartRuntimeAdapters,
  createCartMutationCacheCoordinator,
  createCommittedCartCacheSynchronizer,
} from "@ecommerce/cart";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  deliverOutboxBatch,
  clockLayer,
  idGeneratorLayer,
} from "@ecommerce/core";
import type {
  CommerceQueueConsumer,
  CommerceQueueConsumeContext,
  CommerceQueueMessage,
} from "@ecommerce/core";
import {
  PostgresCartRepositoryLayer,
  PostgresCustomerRepositoryLayer,
  PostgresFulfillmentRepositoryLayer,
  PostgresInventoryRepositoryLayer,
  PostgresNotificationEventRepositoryLayer,
  PostgresOrderRepositoryLayer,
  PostgresPaymentRepositoryLayer,
  PostgresPricingRepositoryLayer,
  PostgresProductRepositoryLayer,
  PostgresPromotionRepositoryLayer,
  PostgresRegionSalesChannelRepositoryLayer,
  PostgresStoreRepositoryLayer,
  PostgresTaxRepositoryLayer,
  PostgresOutboxLayer,
  PostgresTransactionBoundaryLayer,
  createPostgresDatabaseLayer,
  createPostgresPoolConfig,
} from "@ecommerce/db-postgres";
import {
  NotificationEventRepositoryService,
  NotificationEventService,
} from "@ecommerce/notification-event";
import {
  createCloudflareCartActiveCache,
  createCloudflareCartCacheRepository,
  createCloudflareKeyedActorLayer,
  createCloudflareQueuePublisherLayer,
  drainNotificationEventOutbox,
  createNotificationEventRealtimePublisher,
  processNotificationEventQueueBatch,
} from "@ecommerce/platform-cloudflare";
import type { NotificationEventQueueMessage } from "@ecommerce/platform-cloudflare";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";

export type ProductionCommerceRuntimeMode = "development" | "production";

export interface ProductionCommerceRuntimeBindings {
  readonly cartCache?: DurableObjectNamespace;
  readonly commerceEventQueue?: Queue<CommerceQueueMessage>;
  readonly notificationEventQueue?: Queue<NotificationEventQueueMessage>;
  readonly notificationEventRealtime?: DurableObjectNamespace;
  readonly postgres?: Hyperdrive;
  readonly statefulCoordinator?: DurableObjectNamespace;
}

export class ProductionCommerceRuntimeConfigError extends Schema.TaggedErrorClass<ProductionCommerceRuntimeConfigError>()(
  "ProductionCommerceRuntimeConfigError",
  {
    binding: Schema.NonEmptyString,
    message: Schema.NonEmptyString,
    mode: Schema.String,
  }
) {}

export interface ProductionCommerceRuntimeDiagnostics {
  readonly adapters: {
    readonly actor: "cloudflare-durable-object";
    readonly cartCache: "cloudflare-durable-object";
    readonly notifications: "cloudflare-queue" | "disabled";
    readonly providers: {
      readonly fulfillment: "disabled";
      readonly notification: "disabled";
      readonly payment: "disabled";
      readonly tax: "manual";
    };
    readonly relational: "effect-postgres";
  };
  readonly contributionCounts: {
    readonly adminSurfaces: number;
    readonly apiGroups: number;
    readonly eventHandlers: number;
    readonly providers: number;
    readonly services: number;
    readonly workflows: number;
  };
  readonly modules: readonly string[];
}

export interface CreateProductionCommerceRuntimeCompositionOptions {
  readonly bindings: ProductionCommerceRuntimeBindings;
  readonly commerceEventConsumer?: CommerceQueueConsumer;
  readonly mode: ProductionCommerceRuntimeMode;
}

const requireBinding = <TBinding>({
  binding,
  mode,
  value,
}: {
  readonly binding: string;
  readonly mode: ProductionCommerceRuntimeMode;
  readonly value: TBinding | undefined;
}): TBinding => {
  if (value !== undefined) {
    return value;
  }

  throw new ProductionCommerceRuntimeConfigError({
    binding,
    message: `Runtime composition requires the ${binding} binding.`,
    mode,
  });
};

const requireRuntimeMode = (mode: unknown): ProductionCommerceRuntimeMode => {
  if (mode === "development" || mode === "production") {
    return mode;
  }

  throw new ProductionCommerceRuntimeConfigError({
    binding: "COMMERCE_RUNTIME_MODE",
    message:
      "Runtime composition requires an explicit development or production mode.",
    mode: typeof mode === "string" ? mode : "missing",
  });
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCommerceQueueMessage = (
  message: unknown
): message is CommerceQueueMessage =>
  isObjectRecord(message) &&
  message.queueName === COMMERCE_EVENTS_OUTBOX_TOPIC &&
  typeof message.id === "string" &&
  typeof message.type === "string" &&
  typeof message.correlationId === "string" &&
  typeof message.idempotencyKey === "string";

const getMessageAttempt = (message: Message<unknown>): number =>
  "attempts" in message && typeof message.attempts === "number"
    ? message.attempts
    : 1;

const processCommerceEventQueueBatch = async (
  batch: MessageBatch<unknown>,
  consumer: CommerceQueueConsumer
): Promise<void> => {
  const failures: unknown[] = [];

  for (const message of batch.messages) {
    if (isCommerceQueueMessage(message.body)) {
      const context: CommerceQueueConsumeContext = {
        attempt: getMessageAttempt(message),
        retryPolicy: {
          backoffSeconds: [30, 120, 300],
          maxAttempts: 3,
        },
      };

      try {
        await consumer.consume(message.body, context);
        message.ack();
      } catch (error) {
        message.retry();
        failures.push(error);
      }
    } else {
      message.retry();
    }
  }

  if (failures.length > 0) {
    throw failures[0];
  }
};

const requirePostgresConnectionString = (
  connectionString: string,
  mode: ProductionCommerceRuntimeMode
): string => {
  try {
    const url = new URL(connectionString);

    if (url.protocol === "postgres:" || url.protocol === "postgresql:") {
      return connectionString;
    }
  } catch {
    // Normalize malformed secrets to the same redacted configuration error.
  }

  throw new ProductionCommerceRuntimeConfigError({
    binding: "POSTGRES",
    message:
      "Runtime composition requires a valid PostgreSQL connection string.",
    mode,
  });
};

const createRuntimeClock = () => ({
  now: () => new Date(),
});

const createRuntimeIdGenerator = () => ({
  nextId: () => crypto.randomUUID(),
});

/**
 * Selects every production commerce adapter in one place. The returned Layer
 * is fully satisfied: module handlers cannot fall back to process-local state.
 */
export const createProductionCommerceRuntimeComposition = ({
  bindings,
  commerceEventConsumer,
  mode,
}: CreateProductionCommerceRuntimeCompositionOptions) => {
  // Checkout remains disabled until its completion-store contract has a
  // durable production adapter. Selection happens before graph validation, so
  // its routes, permissions, workflow, and service disappear together.
  const moduleComposition = composeBuiltinCommerceApplication({
    disabledModuleKeys: ["checkout"],
  });
  const runtimeMode = requireRuntimeMode(mode);
  const cartCache = requireBinding({
    binding: "CART_CACHE",
    mode: runtimeMode,
    value: bindings.cartCache,
  });
  const notificationEventRealtimeNamespace = requireBinding({
    binding: "NOTIFICATION_EVENT_REALTIME",
    mode: runtimeMode,
    value: bindings.notificationEventRealtime,
  });
  const postgres = requireBinding({
    binding: "POSTGRES",
    mode: runtimeMode,
    value: bindings.postgres,
  });
  const postgresConnectionString = requirePostgresConnectionString(
    postgres.connectionString,
    runtimeMode
  );
  const statefulCoordinator = requireBinding({
    binding: "STATEFUL_COORDINATOR",
    mode: runtimeMode,
    value: bindings.statefulCoordinator,
  });
  const notificationEventQueue =
    runtimeMode === "production"
      ? requireBinding({
          binding: "NOTIFICATION_EVENT_QUEUE",
          mode: runtimeMode,
          value: bindings.notificationEventQueue,
        })
      : bindings.notificationEventQueue;
  const commerceEventQueue =
    runtimeMode === "production"
      ? requireBinding({
          binding: "COMMERCE_EVENT_QUEUE",
          mode: runtimeMode,
          value: bindings.commerceEventQueue,
        })
      : bindings.commerceEventQueue;
  const clock = createRuntimeClock();
  const idGenerator = createRuntimeIdGenerator();
  const databaseLayer = createPostgresDatabaseLayer({
    postgres: createPostgresPoolConfig({
      applicationName: `@ecommerce/server:${runtimeMode}`,
      maxConnections: 5,
      url: postgresConnectionString,
    }),
  }).pipe(Layer.orDie);
  const postgresCartRepositoryLayer = PostgresCartRepositoryLayer.pipe(
    Layer.provide(databaseLayer)
  );
  const cartRepositoryLayer = Layer.effect(
    CartRepositoryService,
    CartRepositoryService.use((projectionRepository) =>
      Effect.succeed(
        createCloudflareCartCacheRepository({
          namespace: cartCache,
          projectionRepository,
        })
      )
    )
  ).pipe(Layer.provide(postgresCartRepositoryLayer));
  const cartRuntimeAdaptersLayer = Layer.effect(
    CartRuntimeAdapters,
    CartRepositoryService.use((projectionRepository) => {
      const activeCache = createCloudflareCartActiveCache({
        namespace: cartCache,
      });
      return Effect.succeed({
        committedMutationSynchronizer: createCommittedCartCacheSynchronizer({
          cache: activeCache,
          projectionRepository,
        }),
        mutationCacheCoordinator: createCartMutationCacheCoordinator({
          cache: activeCache,
        }),
        mutationRepository: projectionRepository,
      });
    })
  ).pipe(Layer.provide(postgresCartRepositoryLayer));
  const repositoryLayer = Layer.mergeAll(
    cartRepositoryLayer,
    PostgresCustomerRepositoryLayer,
    PostgresFulfillmentRepositoryLayer,
    PostgresInventoryRepositoryLayer,
    PostgresNotificationEventRepositoryLayer,
    PostgresOrderRepositoryLayer,
    PostgresPaymentRepositoryLayer,
    PostgresPricingRepositoryLayer,
    PostgresProductRepositoryLayer,
    PostgresPromotionRepositoryLayer,
    PostgresRegionSalesChannelRepositoryLayer,
    PostgresStoreRepositoryLayer,
    PostgresTaxRepositoryLayer
  ).pipe(Layer.provide(databaseLayer));
  const mutationPersistenceLayer = Layer.mergeAll(
    PostgresOutboxLayer,
    PostgresTransactionBoundaryLayer
  ).pipe(Layer.provide(databaseLayer));
  const commerceOutboxDeliveryLayer = commerceEventQueue
    ? Layer.mergeAll(
        PostgresOutboxLayer,
        createCloudflareQueuePublisherLayer({
          clock,
          queue: commerceEventQueue,
        })
      ).pipe(Layer.provide(databaseLayer))
    : undefined;
  const notificationEventRealtime = createNotificationEventRealtimePublisher({
    namespace: notificationEventRealtimeNamespace as unknown as Parameters<
      typeof createNotificationEventRealtimePublisher
    >[0]["namespace"],
  });
  const clockDependencyLayer = clockLayer(clock);
  const idGeneratorDependencyLayer = idGeneratorLayer(idGenerator);
  const actorLayer = createCloudflareKeyedActorLayer({
    namespace: statefulCoordinator,
  });
  const serviceDependenciesLayer = Layer.mergeAll(
    repositoryLayer,
    cartRuntimeAdaptersLayer,
    clockDependencyLayer,
    idGeneratorDependencyLayer,
    mutationPersistenceLayer,
    actorLayer
  );
  const resolvedApplicationLayer = moduleComposition.applicationLayer.pipe(
    Layer.provide(serviceDependenciesLayer)
  );
  const applicationLayer = resolvedApplicationLayer.pipe(Layer.orDie);
  const commerceEventRuntime =
    commerceEventConsumer === undefined
      ? (() => {
          const runtime = ManagedRuntime.make(resolvedApplicationLayer);

          return {
            consumer: {
              consume: (message: CommerceQueueMessage) =>
                runtime.runPromise(
                  NotificationEventService.use((service) =>
                    service.publishEvent({
                      causationId: message.causationId,
                      correlationId: message.correlationId,
                      name: message.type,
                      payload: message.payload,
                      sourceModule: "commerce-events",
                      subject: message.subject,
                      workflowRunId: message.workflowRunId,
                    })
                  ).pipe(Effect.asVoid)
                ),
            } satisfies CommerceQueueConsumer,
            dispose: runtime.dispose,
          };
        })()
      : {
          consumer: commerceEventConsumer,
          dispose: () => Promise.resolve(),
        };
  const notificationEventRepositoryLayer =
    PostgresNotificationEventRepositoryLayer.pipe(Layer.provide(databaseLayer));
  const processNotificationEventQueue = (
    batch: MessageBatch<NotificationEventQueueMessage>
  ): Promise<void> =>
    Effect.runPromise(
      NotificationEventRepositoryService.use((repository) =>
        Effect.promise(() =>
          processNotificationEventQueueBatch(batch, {
            clock,
            notificationProviders: [],
            repository,
            retryPolicy: {
              backoffSeconds: [30, 120, 300],
              maxAttempts: 3,
            },
            realtime: notificationEventRealtime,
          })
        )
      ).pipe(Effect.provide(notificationEventRepositoryLayer))
    );
  const drainNotificationOutbox = (): Promise<void> =>
    Effect.runPromise(
      NotificationEventRepositoryService.use((repository) =>
        Effect.promise(async () => {
          await drainNotificationEventOutbox({
            clock,
            limit: 100,
            queue: notificationEventQueue,
            repository,
            retryPolicy: {
              backoffSeconds: [30, 120, 300],
              maxAttempts: 3,
            },
            realtime: notificationEventRealtime,
          });
        })
      ).pipe(Effect.provide(notificationEventRepositoryLayer))
    );
  const drainCommerceEventOutbox = async (): Promise<void> => {
    if (!commerceOutboxDeliveryLayer) {
      return;
    }

    await Effect.runPromise(
      deliverOutboxBatch({
        limit: 100,
        topic: COMMERCE_EVENTS_OUTBOX_TOPIC,
      }).pipe(Effect.provide(commerceOutboxDeliveryLayer))
    );
  };

  return {
    applicationLayer,
    apiGroups: moduleComposition.apiGroups,
    diagnostics: {
      adapters: {
        actor: "cloudflare-durable-object",
        cartCache: "cloudflare-durable-object",
        notifications: notificationEventQueue ? "cloudflare-queue" : "disabled",
        providers: {
          fulfillment: "disabled",
          notification: "disabled",
          payment: "disabled",
          tax: "manual",
        },
        relational: "effect-postgres",
      },
      contributionCounts: {
        adminSurfaces: moduleComposition.adminSurfaces.length,
        apiGroups: moduleComposition.apiGroups.length,
        eventHandlers: moduleComposition.eventHandlers.length,
        providers: moduleComposition.providers.length,
        services: moduleComposition.services.length,
        workflows: moduleComposition.workflows.length,
      },
      modules: moduleComposition.orderedKeys,
    },
    dispose: commerceEventRuntime.dispose,
    drainCommerceEventOutbox,
    drainNotificationEventOutbox: drainNotificationOutbox,
    processCommerceEventQueue: (batch: MessageBatch<unknown>) =>
      processCommerceEventQueueBatch(batch, commerceEventRuntime.consumer),
    processNotificationEventQueue,
    permissions: moduleComposition.permissions,
  };
};
