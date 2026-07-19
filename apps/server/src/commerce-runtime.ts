import { createApiRootAssembly } from "@ecommerce/api";
import type {
  CartD1Database,
  CartModuleContext,
  CartRepository,
} from "@ecommerce/cart";
import { createCartService, createD1CartRepository } from "@ecommerce/cart";
import type {
  ClockServiceShape,
  EventPublisherServiceShape,
  IdGeneratorServiceShape,
} from "@ecommerce/core";
import type { StatefulCoordinator } from "@ecommerce/core/stateful";
import {
  createCustomerIdEffect,
  createCustomerService,
} from "@ecommerce/customer";
import { developmentSeedIds } from "@ecommerce/db-d1/seed";
import {
  createFakeFulfillmentProvider,
  createFulfillmentProviderRegistry,
  createFulfillmentService,
} from "@ecommerce/fulfillment";
import type { FulfillmentProviderRegistry } from "@ecommerce/fulfillment";
import { createD1FulfillmentRepository } from "@ecommerce/fulfillment/adapters/d1";
import type { FulfillmentD1Database } from "@ecommerce/fulfillment/adapters/d1";
import {
  createD1InventoryRepository,
  createInventoryService,
} from "@ecommerce/inventory";
import type { InventoryD1Database } from "@ecommerce/inventory";
import {
  createD1NotificationEventRepository,
  createNotificationEventService,
} from "@ecommerce/notification-event";
import type {
  CreateNotificationEventServiceOptions,
  NotificationEventD1Database,
  NotificationProvider,
} from "@ecommerce/notification-event";
import { createD1OrderRepository, createOrderService } from "@ecommerce/order";
import type { OrderD1Database } from "@ecommerce/order";
import {
  createFakePaymentProvider,
  createPaymentProviderRegistry,
  createPaymentService,
} from "@ecommerce/payment";
import type { PaymentProviderRegistry } from "@ecommerce/payment";
import { createD1PaymentRepository } from "@ecommerce/payment/adapters/d1";
import type { PaymentD1Database } from "@ecommerce/payment/adapters/d1";
import {
  createD1PricingRepository,
  createPricingService,
} from "@ecommerce/pricing";
import type { PricingD1Database } from "@ecommerce/pricing";
import { createProductIdEffect } from "@ecommerce/product";
import {
  createD1PromotionRepository,
  createPromotionService,
} from "@ecommerce/promotion";
import type { PromotionD1Database } from "@ecommerce/promotion";
import { createStoreService } from "@ecommerce/store";
import { createD1TaxRepository, createTaxService } from "@ecommerce/tax";
import type { TaxD1Database } from "@ecommerce/tax";
import { Effect } from "effect";

type NotificationEventRuntimeHooks = NonNullable<
  CreateNotificationEventServiceOptions["runtime"]
>;

interface ServerCommerceDatabase {
  readonly destroy?: () => Promise<void>;
}

export interface ServerCommerceRuntimeOptions {
  readonly cartCoordinator?: StatefulCoordinator;
  readonly createCartRepositoryForContext?: (
    context: CartModuleContext
  ) => CartRepository;
  readonly cartRepository?: CartRepository;
  readonly clock?: ClockServiceShape;
  readonly db: ServerCommerceDatabase;
  readonly fulfillmentProviderRegistry?: FulfillmentProviderRegistry;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly inventoryCoordinator?: StatefulCoordinator;
  readonly notificationProviders?: readonly NotificationProvider[];
  readonly notificationRuntime?: NotificationEventRuntimeHooks;
  readonly paymentProviderRegistry?: PaymentProviderRegistry;
}

const narrowDatabase = <Database>(db: ServerCommerceDatabase): Database =>
  db as unknown as Database;

/**
 * Creates deterministic provider registries for local development and tests.
 * Callers must opt in; production composition never receives these implicitly.
 */
export const createDevelopmentCommerceProviderRegistries = () => ({
  fulfillmentProviderRegistry: createFulfillmentProviderRegistry([
    createFakeFulfillmentProvider({ id: "manual" }),
  ]),
  paymentProviderRegistry: createPaymentProviderRegistry([
    createFakePaymentProvider({ id: "manual" }),
  ]),
});

/**
 * Composes the server-owned commerce runtime from module public adapters.
 * Domain behavior remains in module packages; this factory only owns wiring.
 */
export const createServerCommerceRuntime = ({
  cartCoordinator,
  cartRepository: providedCartRepository,
  clock,
  createCartRepositoryForContext,
  db,
  fulfillmentProviderRegistry,
  idGenerator,
  inventoryCoordinator,
  notificationProviders,
  notificationRuntime,
  paymentProviderRegistry,
}: ServerCommerceRuntimeOptions) => {
  const hasPaymentProviders = paymentProviderRegistry !== undefined;
  const hasFulfillmentProviders = fulfillmentProviderRegistry !== undefined;

  if (hasPaymentProviders !== hasFulfillmentProviders) {
    throw new Error(
      "Checkout composition requires both payment and fulfillment provider registries."
    );
  }

  const repositories = {
    cart:
      providedCartRepository ??
      createD1CartRepository({
        db: narrowDatabase<CartD1Database>(db),
      }),
    fulfillment: createD1FulfillmentRepository({
      db: narrowDatabase<FulfillmentD1Database>(db),
    }),
    inventory: createD1InventoryRepository({
      db: narrowDatabase<InventoryD1Database>(db),
    }),
    notificationEvent: createD1NotificationEventRepository({
      db: narrowDatabase<NotificationEventD1Database>(db),
    }),
    order: createD1OrderRepository({ db: narrowDatabase<OrderD1Database>(db) }),
    payment: createD1PaymentRepository({
      db: narrowDatabase<PaymentD1Database>(db),
    }),
    pricing: createD1PricingRepository({
      db: narrowDatabase<PricingD1Database>(db),
    }),
    promotion: createD1PromotionRepository({
      db: narrowDatabase<PromotionD1Database>(db),
    }),
    tax: createD1TaxRepository({ db: narrowDatabase<TaxD1Database>(db) }),
  };

  const notificationEvent = createNotificationEventService({
    clock,
    idGenerator,
    notificationProviders,
    repository: repositories.notificationEvent,
    runtime: notificationRuntime,
  });
  const eventPublisher: EventPublisherServiceShape = {
    publish: async (event) => {
      await notificationEvent.publishEvent({
        causationId: event.causationId,
        correlationId: event.correlationId,
        name: event.name,
        payload: event.payload,
        sourceModule: event.sourceModule ?? "server",
        subject: event.subject,
        workflowRunId: event.workflowRunId,
      });
    },
  };
  const sharedServiceOptions = { clock, eventPublisher, idGenerator };
  const storeService = createStoreService({
    clock,
    eventPublisher,
    idGenerator: { nextId: () => "store_checkout_defaults" },
  });
  const checkoutStoreService = {
    getStoreDefaults: () => Effect.runPromise(storeService.getStoreDefaults),
  };
  const customerService = createCustomerService({
    clock,
    idGenerator,
  });
  const checkoutCustomerService = {
    getPaymentIdentity: (customerId: string) =>
      Effect.runPromise(
        createCustomerIdEffect(customerId).pipe(
          Effect.flatMap(customerService.getPaymentIdentity)
        )
      ),
  };
  const checkoutProductService = {
    validateProductVariant: (input: Record<string, unknown>) =>
      Effect.runPromise(
        Effect.gen(function* validateCheckoutProductVariantEffect() {
          const productId = String(input.productId ?? "");
          const variantId = String(input.variantId ?? "");
          const decodedProductId = yield* createProductIdEffect(productId);
          const valid =
            productId === developmentSeedIds.product &&
            variantId === developmentSeedIds.productVariant;

          return {
            productId: decodedProductId,
            productStatus: valid ? "active" : "archived",
            valid,
            variantId,
            variantStatus: valid ? "active" : null,
          } as const;
        })
      ),
  };
  /*
   * Temporary checkout compatibility bridge.
   *
   * Task 7.3 removed the region/sales-channel D1 repository and legacy oRPC
   * routes after moving that module to Effect HTTP + PostgreSQL. Checkout is
   * still a section-8 legacy Promise orchestrator, so it cannot consume the new
   * Effect services directly without widening this task into checkout
   * migration. Keep this server-owned facade deterministic and limited to the
   * development golden-path IDs. Delete it in task 8.6 when checkout orchestration
   * moves to Effect and can depend on migrated module service Layers directly.
   */
  const checkoutRegionService = {
    validateRegionConstraints: (input: Record<string, unknown>) => {
      const regionId = String(input.regionId ?? "");
      const countryCode = String(input.countryCode ?? "").toUpperCase();
      const currencyCode = String(input.currencyCode ?? "").toUpperCase();
      const fulfillmentOptionId = String(input.fulfillmentOptionId ?? "");
      const paymentProviderId = String(input.paymentProviderId ?? "");

      if (regionId !== developmentSeedIds.region) {
        return Promise.resolve({
          allowed: false,
          reasons: ["region-not-found"],
        } as const);
      }

      const reasons: string[] = [];

      if (currencyCode && currencyCode !== "USD") {
        reasons.push("currency-not-allowed");
      }

      if (countryCode && countryCode !== "US") {
        reasons.push("country-not-allowed");
      }

      if (paymentProviderId && paymentProviderId !== "manual") {
        reasons.push("payment-provider-not-available");
      }

      if (
        fulfillmentOptionId &&
        fulfillmentOptionId !== developmentSeedIds.fulfillmentOption
      ) {
        reasons.push("fulfillment-option-not-available");
      }

      return Promise.resolve({
        allowed: reasons.length === 0,
        reasons,
      });
    },
  };
  /*
   * Temporary checkout compatibility bridge.
   *
   * Mirrors only the development storefront publishability invariant that the
   * deleted D1 `sales_channel_product` seed row used to provide. Do not extend
   * this into a general sales-channel adapter; migrated code must use the
   * Effect HTTP/Layer-backed region-sales-channel module. Task 8.6 removes this
   * facade with the legacy checkout API/schema path.
   */
  const checkoutSalesChannelService = {
    checkProductPublishability: (input: Record<string, unknown>) => {
      const productId = String(input.productId ?? "");
      const salesChannelId = String(input.salesChannelId ?? "");

      if (salesChannelId !== developmentSeedIds.salesChannel) {
        return Promise.resolve({
          publishable: false,
          reasons: ["sales-channel-not-found"],
        } as const);
      }

      const reasons =
        productId === developmentSeedIds.product
          ? []
          : ["product-not-published-to-channel"];

      return Promise.resolve({
        publishable: reasons.length === 0,
        reasons,
      });
    },
  };
  const services = {
    cart: createCartService({
      clock,
      coordinator: cartCoordinator,
      eventPublisher,
      idGenerator,
      repository: repositories.cart,
    }),
    customer: checkoutCustomerService,
    fulfillment: createFulfillmentService({
      clock,
      idGenerator,
      providerRegistry: fulfillmentProviderRegistry,
      repository: repositories.fulfillment,
    }),
    inventory: createInventoryService({
      clock,
      coordinator: inventoryCoordinator,
      eventPublisher,
      idGenerator,
      repository: repositories.inventory,
    }),
    notificationEvent,
    order: createOrderService({
      ...sharedServiceOptions,
      repository: repositories.order,
    }),
    payment: createPaymentService({
      clock,
      idGenerator,
      providerRegistry: paymentProviderRegistry,
      repository: repositories.payment,
    }),
    pricing: createPricingService({
      ...sharedServiceOptions,
      repository: repositories.pricing,
    }),
    product: checkoutProductService,
    promotion: createPromotionService({
      ...sharedServiceOptions,
      repository: repositories.promotion,
    }),
    region: checkoutRegionService,
    salesChannel: checkoutSalesChannelService,
    store: checkoutStoreService,
    tax: createTaxService({
      ...sharedServiceOptions,
      repository: repositories.tax,
    }),
  };
  const checkoutServices =
    paymentProviderRegistry && fulfillmentProviderRegistry
      ? {
          cart: services.cart,
          customer: services.customer,
          fulfillment: services.fulfillment,
          inventory: services.inventory,
          notificationEvent: services.notificationEvent,
          order: services.order,
          payment: services.payment,
          pricing: services.pricing,
          product: services.product,
          promotion: services.promotion,
          region: services.region,
          salesChannel: services.salesChannel,
          store: services.store,
          tax: services.tax,
        }
      : undefined;
  const checkout = checkoutServices
    ? {
        ...checkoutServices,
        ...(createCartRepositoryForContext
          ? {
              createServiceOptionsForContext: (context: CartModuleContext) => ({
                ...checkoutServices,
                cart: createCartService({
                  clock,
                  coordinator: cartCoordinator,
                  eventPublisher,
                  idGenerator,
                  repository: createCartRepositoryForContext(context),
                }),
              }),
            }
          : {}),
      }
    : undefined;

  const apiAssembly = createApiRootAssembly({
    routes: {
      cart: {
        clock,
        coordinator: cartCoordinator,
        ...(createCartRepositoryForContext
          ? {
              createServiceOptionsForContext: (context: CartModuleContext) => ({
                clock,
                coordinator: cartCoordinator,
                eventPublisher,
                idGenerator,
                repository: createCartRepositoryForContext(context),
              }),
            }
          : {}),
        eventPublisher,
        idGenerator,
        repository: repositories.cart,
      },
      ...(checkout ? { checkout } : {}),
      fulfillment: {
        clock,
        idGenerator,
        providerRegistry: fulfillmentProviderRegistry,
        repository: repositories.fulfillment,
      },
      inventory: {
        clock,
        coordinator: inventoryCoordinator,
        eventPublisher,
        idGenerator,
        repository: repositories.inventory,
      },
      notificationEvent: {
        clock,
        idGenerator,
        notificationProviders,
        repository: repositories.notificationEvent,
        runtime: notificationRuntime,
      },
      order: {
        ...sharedServiceOptions,
        repository: repositories.order,
      },
      payment: {
        clock,
        idGenerator,
        providerRegistry: paymentProviderRegistry,
        repository: repositories.payment,
      },
      pricing: {
        ...sharedServiceOptions,
        repository: repositories.pricing,
      },
      promotion: {
        ...sharedServiceOptions,
        repository: repositories.promotion,
      },
      tax: {
        ...sharedServiceOptions,
        repository: repositories.tax,
      },
    },
  });

  return {
    apiAssembly,
    checkoutConfigured: checkout !== undefined,
    repositories,
    services,
  };
};
