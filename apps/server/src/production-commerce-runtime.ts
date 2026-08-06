import {
  CartRepositoryService,
  CartService,
  createCartService,
} from "@ecommerce/cart";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  clockLayer,
  idGeneratorLayer,
} from "@ecommerce/core";
import { KeyedActorService } from "@ecommerce/core/stateful";
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
  createCloudflareCartCacheRepository,
  createCloudflareKeyedActorLayer,
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
  readonly processNotificationEventQueue: (
    batch: MessageBatch<NotificationEventQueueMessage>
  ) => Promise<void>;
  readonly drainNotificationEventOutbox: () => Promise<void>;
}

export interface CreateProductionCommerceRuntimeCompositionOptions {
  readonly bindings: ProductionCommerceRuntimeBindings;
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
    actorLayer
  );
  const cartServiceLayer = Layer.effect(
    CartService,
    Effect.gen(function* createProductionCartService() {
      const actorService = yield* KeyedActorService;
      const projectionRepository = yield* CartRepositoryService;
      const runtimeClock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createCartService({
        actorService,
        clock: runtimeClock,
        eventPublisher,
        idGenerator: runtimeIdGenerator,
        repository: createCloudflareCartCacheRepository({
          namespace: cartCache,
          projectionSyncFailureMode: "fail-write",
          projectionRepository,
        }),
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
      const eventPublisher = yield* EventPublisherService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createFulfillmentService({
        clock: runtimeClock,
        eventPublisher,
        idGenerator: runtimeIdGenerator,
        providerRegistry: fulfillmentProviderRegistry,
        repository,
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
      const eventPublisher = yield* EventPublisherService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createPromotionService({
        clock: runtimeClock,
        eventPublisher,
        idGenerator: runtimeIdGenerator,
        repository,
      });
    })
  );
  const taxServiceLayer = Layer.effect(
    TaxService,
    Effect.gen(function* createProductionTaxService() {
      const repository = yield* TaxRepositoryService;
      const runtimeClock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createTaxService({
        clock: runtimeClock,
        eventPublisher,
        idGenerator: runtimeIdGenerator,
        providers: [manualTaxProvider],
        repository,
      });
    })
  );
  const orderServiceLayer = Layer.effect(
    OrderService,
    Effect.gen(function* createProductionOrderService() {
      const repository = yield* OrderRepositoryService;
      const runtimeClock = yield* ClockService;
      const eventPublisher = yield* EventPublisherService;
      const runtimeIdGenerator = yield* IdGeneratorService;

      return createOrderService({
        clock: runtimeClock,
        eventPublisher,
        idGenerator: runtimeIdGenerator,
        repository,
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
    drainNotificationEventOutbox: drainNotificationOutbox,
    processNotificationEventQueue,
  };
};
