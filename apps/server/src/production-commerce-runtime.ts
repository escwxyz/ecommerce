import {
  CartRepositoryService,
  CartService,
  createCartMutationCacheCoordinator,
  createCommittedCartCacheSynchronizer,
  createCartService,
} from "@ecommerce/cart";
import {
  COMMERCE_EVENTS_OUTBOX_TOPIC,
  ClockService,
  deliverOutboxBatch,
  EventPublisherService,
  IdGeneratorService,
  OutboxWriterService,
  TransactionBoundaryService,
  clockLayer,
  idGeneratorLayer,
} from "@ecommerce/core";
import type {
  CommerceQueueConsumer,
  CommerceQueueConsumeContext,
  CommerceQueueMessage,
} from "@ecommerce/core";
import { createCustomerServiceFromDependenciesLayer } from "@ecommerce/customer";
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
  FulfillmentRepositoryService,
  FulfillmentService,
  createFulfillmentProviderRegistry,
  createFulfillmentService,
} from "@ecommerce/fulfillment";
import { createInventoryServiceFromDependenciesLayer } from "@ecommerce/inventory";
import {
  NotificationEventRepositoryService,
  NotificationEventService,
  createNotificationEventService,
} from "@ecommerce/notification-event";
import {
  OrderRepositoryService,
  OrderService,
  createOrderService,
} from "@ecommerce/order";
import {
  PaymentRepositoryService,
  PaymentService,
  createPaymentProviderRegistry,
  createPaymentService,
} from "@ecommerce/payment";
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
import { createPricingServiceFromDependenciesLayer } from "@ecommerce/pricing";
import { createProductServiceFromDependenciesLayer } from "@ecommerce/product";
import {
  PromotionRepositoryService,
  PromotionService,
  createPromotionService,
} from "@ecommerce/promotion";
import {
  createRegionServiceFromDependenciesLayer,
  createSalesChannelServiceFromDependenciesLayer,
} from "@ecommerce/region-sales-channel";
import { createStoreServiceFromDependenciesLayer } from "@ecommerce/store";
import {
  TaxRepositoryService,
  TaxService,
  createTaxService,
  manualTaxProvider,
} from "@ecommerce/tax";
import { Effect, Layer, Schema } from "effect";
import type { Layer as EffectLayer } from "effect/Layer";

const productionModuleKeys = [
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
] as const;

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
  readonly modules: typeof productionModuleKeys;
}

export interface ProductionCommerceRuntimeComposition {
  readonly applicationLayer: EffectLayer<never, never, never>;
  readonly diagnostics: ProductionCommerceRuntimeDiagnostics;
  readonly drainCommerceEventOutbox: () => Promise<void>;
  readonly processCommerceEventQueue: (
    batch: MessageBatch<unknown>
  ) => Promise<void>;
  readonly processNotificationEventQueue: (
    batch: MessageBatch<NotificationEventQueueMessage>
  ) => Promise<void>;
  readonly drainNotificationEventOutbox: () => Promise<void>;
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
}: CreateProductionCommerceRuntimeCompositionOptions): ProductionCommerceRuntimeComposition => {
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
  const repositoryLayer = Layer.mergeAll(
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
  const notificationEventServiceLayer = Layer.effect(
    NotificationEventService,
    Effect.gen(function* createProductionNotificationEventService() {
      const repository = yield* NotificationEventRepositoryService;

      return createNotificationEventService({
        clock,
        idGenerator,
        notificationProviders: [],
        repository,
      });
    })
  ).pipe(Layer.provide(repositoryLayer));
  const domainEventPublisherLayer = Layer.effect(
    EventPublisherService,
    NotificationEventService.use((service) =>
      Effect.succeed({
        publish: async (event) => {
          await Effect.runPromise(
            service.publishEvent({
              causationId: event.causationId,
              correlationId: event.correlationId,
              name: event.name,
              payload: event.payload,
              sourceModule: event.sourceModule ?? "server",
              subject: event.subject,
              workflowRunId: event.workflowRunId,
            })
          );
        },
      })
    )
  ).pipe(Layer.provide(notificationEventServiceLayer));
  const actorLayer = createCloudflareKeyedActorLayer({
    namespace: statefulCoordinator,
  });
  const serviceDependenciesLayer = Layer.mergeAll(
    repositoryLayer,
    clockDependencyLayer,
    idGeneratorDependencyLayer,
    domainEventPublisherLayer,
    mutationPersistenceLayer,
    actorLayer
  );
  const cartServiceLayer = Layer.effect(
    CartService,
    Effect.gen(function* createProductionCartService() {
      const projectionRepository = yield* CartRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const transactionBoundary = yield* TransactionBoundaryService;
      const activeCache = createCloudflareCartActiveCache({
        namespace: cartCache,
      });
      const cachedRepository = createCloudflareCartCacheRepository({
        namespace: cartCache,
        projectionRepository,
      });

      return createCartService({
        clock: runtimeClock,
        committedMutationSynchronizer: createCommittedCartCacheSynchronizer({
          cache: activeCache,
          projectionRepository,
        }),
        idGenerator: runtimeIdGenerator,
        mutationCacheCoordinator: createCartMutationCacheCoordinator({
          cache: activeCache,
        }),
        mutationRepository: projectionRepository,
        outboxWriter,
        repository: cachedRepository,
        transactionBoundary,
      });
    })
  );
  const fulfillmentProviderRegistry = createFulfillmentProviderRegistry([]);
  const paymentProviderRegistry = createPaymentProviderRegistry([]);
  const fulfillmentServiceLayer = Layer.effect(
    FulfillmentService,
    Effect.gen(function* createProductionFulfillmentService() {
      const repository = yield* FulfillmentRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const transactionBoundary = yield* TransactionBoundaryService;

      return createFulfillmentService({
        clock: runtimeClock,
        idGenerator: runtimeIdGenerator,
        outboxWriter,
        providerRegistry: fulfillmentProviderRegistry,
        repository,
        transactionBoundary,
      });
    })
  );
  const paymentServiceLayer = Layer.effect(
    PaymentService,
    Effect.gen(function* createProductionPaymentService() {
      const repository = yield* PaymentRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createPaymentService({
        clock: runtimeClock,
        idGenerator: runtimeIdGenerator,
        providerRegistry: paymentProviderRegistry,
        repository,
      });
    })
  );
  const promotionServiceLayer = Layer.effect(
    PromotionService,
    Effect.gen(function* createProductionPromotionService() {
      const repository = yield* PromotionRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const transactionBoundary = yield* TransactionBoundaryService;

      return createPromotionService({
        clock: runtimeClock,
        idGenerator: runtimeIdGenerator,
        outboxWriter,
        repository,
        transactionBoundary,
      });
    })
  );
  const taxServiceLayer = Layer.effect(
    TaxService,
    Effect.gen(function* createProductionTaxService() {
      const repository = yield* TaxRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const transactionBoundary = yield* TransactionBoundaryService;

      return createTaxService({
        clock: runtimeClock,
        idGenerator: runtimeIdGenerator,
        outboxWriter,
        providers: [manualTaxProvider],
        repository,
        transactionBoundary,
      });
    })
  );
  const orderServiceLayer = Layer.effect(
    OrderService,
    Effect.gen(function* createProductionOrderService() {
      const repository = yield* OrderRepositoryService;
      const runtimeClock = yield* ClockService;
      const runtimeIdGenerator = yield* IdGeneratorService;
      const outboxWriter = yield* OutboxWriterService;
      const transactionBoundary = yield* TransactionBoundaryService;

      return createOrderService({
        clock: runtimeClock,
        idGenerator: runtimeIdGenerator,
        outboxWriter,
        repository,
        transactionBoundary,
      });
    })
  );
  const moduleServiceLayer = Layer.mergeAll(
    createStoreServiceFromDependenciesLayer(),
    createCustomerServiceFromDependenciesLayer(),
    createProductServiceFromDependenciesLayer(),
    createPricingServiceFromDependenciesLayer(),
    createInventoryServiceFromDependenciesLayer(),
    cartServiceLayer,
    createRegionServiceFromDependenciesLayer(),
    createSalesChannelServiceFromDependenciesLayer(),
    promotionServiceLayer,
    taxServiceLayer,
    fulfillmentServiceLayer,
    paymentServiceLayer,
    orderServiceLayer,
    notificationEventServiceLayer
  ).pipe(Layer.provide(serviceDependenciesLayer));
  const applicationLayer: EffectLayer<never, never, never> = moduleServiceLayer;
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
  const durableCommerceEventConsumer: CommerceQueueConsumer =
    commerceEventConsumer ?? {
      consume: (message) =>
        Effect.runPromise(
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
          ).pipe(Effect.asVoid, Effect.provide(notificationEventServiceLayer))
        ),
    };
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
      modules: productionModuleKeys,
    },
    drainCommerceEventOutbox,
    drainNotificationEventOutbox: drainNotificationOutbox,
    processCommerceEventQueue: (batch) =>
      processCommerceEventQueueBatch(batch, durableCommerceEventConsumer),
    processNotificationEventQueue,
  };
};
