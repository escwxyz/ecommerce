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
  createCustomerService,
  createD1CustomerRepository,
} from "@ecommerce/customer";
import type { CustomerD1Database } from "@ecommerce/customer";
import type { CommerceKyselyDatabase } from "@ecommerce/db";
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
import {
  createD1ProductRepository,
  createProductService,
} from "@ecommerce/product";
import type { ProductD1Database } from "@ecommerce/product";
import {
  createD1PromotionRepository,
  createPromotionService,
} from "@ecommerce/promotion";
import type { PromotionD1Database } from "@ecommerce/promotion";
import {
  createD1RegionSalesChannelRepository,
  createRegionService,
  createSalesChannelService,
} from "@ecommerce/region-sales-channel";
import type { RegionSalesChannelD1Database } from "@ecommerce/region-sales-channel";
import { createD1StoreRepository, createStoreService } from "@ecommerce/store";
import type { StoreD1Database } from "@ecommerce/store";
import { createD1TaxRepository, createTaxService } from "@ecommerce/tax";
import type { TaxD1Database } from "@ecommerce/tax";

type NotificationEventRuntimeHooks = NonNullable<
  CreateNotificationEventServiceOptions["runtime"]
>;

export interface ServerCommerceRuntimeOptions {
  readonly cartCoordinator?: StatefulCoordinator;
  readonly createCartRepositoryForContext?: (
    context: CartModuleContext
  ) => CartRepository;
  readonly cartRepository?: CartRepository;
  readonly clock?: ClockServiceShape;
  readonly db: CommerceKyselyDatabase;
  readonly fulfillmentProviderRegistry?: FulfillmentProviderRegistry;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly inventoryCoordinator?: StatefulCoordinator;
  readonly notificationProviders?: readonly NotificationProvider[];
  readonly notificationRuntime?: NotificationEventRuntimeHooks;
  readonly paymentProviderRegistry?: PaymentProviderRegistry;
}

const narrowDatabase = <Database>(db: CommerceKyselyDatabase): Database =>
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
    customer: createD1CustomerRepository({
      db: narrowDatabase<CustomerD1Database>(db),
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
    product: createD1ProductRepository({
      db: narrowDatabase<ProductD1Database>(db),
    }),
    promotion: createD1PromotionRepository({
      db: narrowDatabase<PromotionD1Database>(db),
    }),
    regionSalesChannel: createD1RegionSalesChannelRepository({
      db: narrowDatabase<RegionSalesChannelD1Database>(db),
    }),
    store: createD1StoreRepository({
      db: narrowDatabase<StoreD1Database>(db),
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
  const services = {
    cart: createCartService({
      clock,
      coordinator: cartCoordinator,
      eventPublisher,
      idGenerator,
      repository: repositories.cart,
    }),
    customer: createCustomerService({
      clock,
      idGenerator,
      repository: repositories.customer,
    }),
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
    product: createProductService({
      ...sharedServiceOptions,
      repository: repositories.product,
    }),
    promotion: createPromotionService({
      ...sharedServiceOptions,
      repository: repositories.promotion,
    }),
    region: createRegionService({
      ...sharedServiceOptions,
      repository: repositories.regionSalesChannel,
    }),
    salesChannel: createSalesChannelService({
      ...sharedServiceOptions,
      repository: repositories.regionSalesChannel,
    }),
    store: createStoreService({
      ...sharedServiceOptions,
      repository: repositories.store,
    }),
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
      customer: {
        clock,
        idGenerator,
        repository: repositories.customer,
      },
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
      product: {
        ...sharedServiceOptions,
        repository: repositories.product,
      },
      promotion: {
        ...sharedServiceOptions,
        repository: repositories.promotion,
      },
      regionSalesChannel: {
        region: {
          ...sharedServiceOptions,
          repository: repositories.regionSalesChannel,
        },
        salesChannel: {
          ...sharedServiceOptions,
          repository: repositories.regionSalesChannel,
        },
      },
      store: {
        ...sharedServiceOptions,
        repository: repositories.store,
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
