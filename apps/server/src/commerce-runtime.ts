import { createApiRootAssembly } from "@ecommerce/api";
import type { CartRepository, CartServiceShape } from "@ecommerce/cart";
import {
  createCartIdEffect,
  createCartService,
  createInMemoryCartRepository,
} from "@ecommerce/cart";
import type {
  CheckoutModuleContext,
  CreateCheckoutServiceOptions,
} from "@ecommerce/checkout";
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
  createFulfillmentPromiseServiceFromEffectService,
  createFulfillmentProviderRegistry,
  createFulfillmentService,
  createInMemoryFulfillmentRepository,
  createFulfillmentProviderRecordId,
  createFulfillmentSetId,
  createServiceZoneId,
  createShippingOptionId,
  createShippingProfileId,
} from "@ecommerce/fulfillment";
import type { FulfillmentProviderRegistry } from "@ecommerce/fulfillment";
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
import { createProductIdEffect } from "@ecommerce/product";
import {
  CalculatePromotionAdjustmentsInputSchema,
  createInMemoryPromotionRepository,
  createPromotionService,
} from "@ecommerce/promotion";
import type { PromotionServiceShape } from "@ecommerce/promotion";
import { createStoreService } from "@ecommerce/store";
import {
  CalculateTaxInputSchema,
  createInMemoryTaxRepository,
  createTaxCategoryIdEffect,
  createTaxProviderConfigIdEffect,
  createTaxRateIdEffect,
  createTaxRegionIdEffect,
  createTaxService,
} from "@ecommerce/tax";
import type { TaxServiceShape } from "@ecommerce/tax";
import { Effect, Schema } from "effect";

type NotificationEventRuntimeHooks = NonNullable<
  CreateNotificationEventServiceOptions["runtime"]
>;

interface ServerCommerceDatabase {
  readonly destroy?: () => Promise<void>;
}

export interface ServerCommerceRuntimeOptions {
  readonly cartCoordinator?: StatefulCoordinator;
  readonly createCartRepositoryForContext?: (
    context: CheckoutModuleContext
  ) => CartRepository;
  readonly cartRepository?: CartRepository;
  readonly clock?: ClockServiceShape;
  readonly db: ServerCommerceDatabase;
  readonly fulfillmentProviderRegistry?: FulfillmentProviderRegistry;
  readonly idGenerator?: IdGeneratorServiceShape;
  readonly notificationProviders?: readonly NotificationProvider[];
  readonly notificationRuntime?: NotificationEventRuntimeHooks;
  readonly paymentProviderRegistry?: PaymentProviderRegistry;
}

const narrowDatabase = <Database>(db: ServerCommerceDatabase): Database =>
  db as unknown as Database;

type CheckoutCartContract = CreateCheckoutServiceOptions["cart"];
type CheckoutPromotionContract = CreateCheckoutServiceOptions["promotion"];
type CheckoutTaxContract = CreateCheckoutServiceOptions["tax"];

const createCheckoutCartPromiseFacade = (
  service: CartServiceShape
): CheckoutCartContract => ({
  getCart: (id) =>
    Effect.runPromise(
      Effect.gen(function* getCheckoutCartEffect() {
        const cartId = yield* createCartIdEffect(id);
        return yield* service.getCart(cartId);
      })
    ),
  setCheckoutReferences: (input) =>
    Effect.runPromise(
      service.setCheckoutReferences(
        input as Parameters<CartServiceShape["setCheckoutReferences"]>[0]
      )
    ),
  updateTotals: (input) =>
    Effect.runPromise(
      service.updateTotals(
        input as Parameters<CartServiceShape["updateTotals"]>[0]
      )
    ),
});

const createCheckoutPromotionPromiseFacade = (
  service: PromotionServiceShape
): CheckoutPromotionContract => ({
  calculateAdjustments: (input) =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(CalculatePromotionAdjustmentsInputSchema)(
        input
      ).pipe(Effect.flatMap((decoded) => service.calculateAdjustments(decoded)))
    ),
});

const createCheckoutTaxPromiseFacade = (
  service: TaxServiceShape
): CheckoutTaxContract => ({
  calculateTax: (input) =>
    Effect.runPromise(
      Schema.decodeUnknownEffect(CalculateTaxInputSchema)({
        ...(input as Record<string, unknown>),
        items: Array.isArray((input as Record<string, unknown>).items)
          ? (
              (input as Record<string, unknown>).items as readonly unknown[]
            ).map((item) =>
              typeof item === "object" && item !== null
                ? {
                    ...(item as Record<string, unknown>),
                    taxCategoryId:
                      (item as Record<string, unknown>).taxCategoryId ===
                      "default"
                        ? developmentSeedIds.taxCategory
                        : (item as Record<string, unknown>).taxCategoryId,
                  }
                : item
            )
          : (input as Record<string, unknown>).items,
        regionId:
          (input as Record<string, unknown>).regionId ===
          developmentSeedIds.region
            ? developmentSeedIds.taxRegion
            : (input as Record<string, unknown>).regionId,
      }).pipe(Effect.flatMap((decoded) => service.calculateTax(decoded)))
    ),
});

const seedDevelopmentTaxRepository = (
  repository: ReturnType<typeof createInMemoryTaxRepository>
) =>
  Effect.runSync(
    Effect.gen(function* seedDevelopmentTaxRepositoryEffect() {
      const timestamp = new Date(Date.UTC(2026, 0, 1));
      const categoryId = yield* createTaxCategoryIdEffect(
        developmentSeedIds.taxCategory
      );
      const providerConfigId = yield* createTaxProviderConfigIdEffect(
        developmentSeedIds.taxProvider
      );
      const regionId = yield* createTaxRegionIdEffect(
        developmentSeedIds.taxRegion
      );
      const rateId = yield* createTaxRateIdEffect(developmentSeedIds.taxRate);

      yield* repository.saveProviderConfig({
        createdAt: timestamp,
        id: providerConfigId,
        isActive: true,
        metadata: {},
        providerKey: "manual",
        settings: {},
        updatedAt: timestamp,
      });
      yield* repository.saveCategory({
        code: "standard",
        createdAt: timestamp,
        description: "Standard taxable goods",
        id: categoryId,
        metadata: {},
        name: "Standard",
        updatedAt: timestamp,
      });
      yield* repository.saveRegion({
        code: "us",
        countryCode: "US",
        createdAt: timestamp,
        id: regionId,
        metadata: {},
        name: "United States",
        providerConfigId,
        updatedAt: timestamp,
      });
      yield* repository.saveRate({
        categoryId,
        createdAt: timestamp,
        id: rateId,
        metadata: {},
        name: "US standard rate",
        percentage: 8.25,
        regionId,
        updatedAt: timestamp,
      });
    })
  );

const seedDevelopmentFulfillmentRepository = (
  repository: ReturnType<typeof createInMemoryFulfillmentRepository>
) => {
  const timestamp = new Date("2026-01-01T00:00:00.000Z");
  Effect.runSync(
    Effect.gen(function* seedDevelopmentFulfillmentEffect() {
      yield* repository.saveProviderRecord({
        createdAt: timestamp,
        id: createFulfillmentProviderRecordId(
          developmentSeedIds.fulfillmentProvider
        ),
        isEnabled: true,
        providerKey: "manual",
        providerRecordId: "manual",
        updatedAt: timestamp,
      });
      yield* repository.saveFulfillmentSet({
        createdAt: timestamp,
        id: createFulfillmentSetId(developmentSeedIds.fulfillmentSet),
        metadata: {},
        name: "US fulfillment",
        updatedAt: timestamp,
      });
      yield* repository.saveShippingProfile({
        createdAt: timestamp,
        fulfillmentSetId: createFulfillmentSetId(
          developmentSeedIds.fulfillmentSet
        ),
        id: createShippingProfileId("shprof_dev_default"),
        metadata: {},
        name: "Default profile",
        updatedAt: timestamp,
      });
      yield* repository.saveServiceZone({
        countryCodes: ["US"],
        createdAt: timestamp,
        fulfillmentSetId: createFulfillmentSetId(
          developmentSeedIds.fulfillmentSet
        ),
        id: createServiceZoneId("fzone_dev_us"),
        metadata: {},
        name: "United States",
        regionIds: [developmentSeedIds.region],
        updatedAt: timestamp,
      });
      yield* repository.saveShippingOption({
        createdAt: timestamp,
        currencyCode: "USD",
        fulfillmentSetId: createFulfillmentSetId(
          developmentSeedIds.fulfillmentSet
        ),
        id: createShippingOptionId(developmentSeedIds.fulfillmentOption),
        isEnabled: true,
        metadata: {},
        name: "Ground shipping",
        priceAmount: 500,
        profileId: createShippingProfileId("shprof_dev_default"),
        providerKey: "manual",
        providerServiceId: "ground",
        serviceZoneId: createServiceZoneId("fzone_dev_us"),
        updatedAt: timestamp,
      });
    })
  );
};

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
    cart: providedCartRepository ?? createInMemoryCartRepository(),
    // Temporary checkout-only bridge until task 8.6 moves checkout onto
    // Effect module Layers directly. New fulfillment traffic uses Effect HTTP.
    fulfillment: createInMemoryFulfillmentRepository(),
    notificationEvent: createD1NotificationEventRepository({
      db: narrowDatabase<NotificationEventD1Database>(db),
    }),
    order: createD1OrderRepository({ db: narrowDatabase<OrderD1Database>(db) }),
    payment: createD1PaymentRepository({
      db: narrowDatabase<PaymentD1Database>(db),
    }),
    // Temporary checkout-only bridge until task 8.6 moves checkout onto
    // Effect module Layers directly. New promotion traffic uses Effect HTTP.
    promotion: createInMemoryPromotionRepository(),
    // Temporary checkout-only bridge until task 8.6 moves checkout onto
    // Effect module Layers directly. New tax traffic uses Effect HTTP.
    tax: createInMemoryTaxRepository(),
  };
  seedDevelopmentFulfillmentRepository(repositories.fulfillment);
  seedDevelopmentTaxRepository(repositories.tax);

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
   * Task 7.4 removed the pricing D1 repository and legacy oRPC routes after
   * moving pricing to Effect HTTP + PostgreSQL. Checkout remains a section-8
   * legacy Promise orchestrator, so it receives only this development golden
   * path facade. Do not extend this into a general pricing adapter. Delete it
   * in task 8.6 when checkout orchestration moves to Effect services and can
   * depend on the migrated pricing Layer directly.
   */
  const checkoutPricingService = {
    calculatePrice: (input: Record<string, unknown>) => {
      const currencyCode = String(input.currencyCode ?? "").toUpperCase();
      const priceSetId = String(input.priceSetId ?? "");
      const quantity =
        typeof input.quantity === "number" && Number.isInteger(input.quantity)
          ? input.quantity
          : 1;

      if (
        priceSetId !== developmentSeedIds.priceSet ||
        currencyCode !== "USD"
      ) {
        return Promise.reject(
          new Error("No matching development price found.")
        );
      }

      return Promise.resolve({
        amount: 2500,
        currencyCode,
        priceSetId,
        quantity,
        subtotal: 2500 * quantity,
        trace: {
          moneyAmountId: developmentSeedIds.moneyAmount,
          priceListId: null,
          ruleMatches: [],
          source: "base",
        },
      });
    },
  };
  /*
   * Temporary checkout compatibility bridge.
   *
   * Task 7.5 removes the inventory D1 repository, Kysely schema, seed rows, and
   * legacy oRPC route after migrating inventory to Effect HTTP + PostgreSQL.
   * Checkout remains a section-8 legacy Promise orchestrator, so this facade
   * preserves only the development golden-path availability and reservation
   * semantics that were previously supplied by D1 seed rows. It is not a module
   * adapter and must be deleted in task 8.6 when checkout moves to Effect and
   * consumes migrated module service Layers directly.
   */
  const checkoutInventoryService = {
    adjustInventory: () => Promise.resolve({}),
    checkAvailability: (input: Record<string, unknown>) => {
      const inventoryItemId = String(input.inventoryItemId ?? "");
      const stockLocationId = String(
        input.stockLocationId ?? developmentSeedIds.stockLocation
      );

      if (
        inventoryItemId !== developmentSeedIds.inventoryItem ||
        stockLocationId !== developmentSeedIds.stockLocation
      ) {
        return Promise.resolve({
          availableQuantity: 0,
          scopedBy: { stockLocationId },
        });
      }

      return Promise.resolve({
        availableQuantity: 100,
        scopedBy: { stockLocationId },
      });
    },
    reserveInventory: (input: Record<string, unknown>) => {
      const inventoryItemId = String(input.inventoryItemId ?? "");
      const quantity =
        typeof input.quantity === "number" && Number.isInteger(input.quantity)
          ? input.quantity
          : 0;
      const stockLocationId = String(
        input.stockLocationId ?? developmentSeedIds.stockLocation
      );

      if (
        inventoryItemId !== developmentSeedIds.inventoryItem ||
        stockLocationId !== developmentSeedIds.stockLocation ||
        quantity <= 0 ||
        quantity > 100
      ) {
        return Promise.resolve({ reservations: [] });
      }

      return Promise.resolve({
        reservation: {
          inventoryItemId,
          quantity,
          stockLocationId,
        },
      });
    },
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
      eventPublisher,
      idGenerator,
      providerRegistry: fulfillmentProviderRegistry,
      repository: repositories.fulfillment,
    }),
    inventory: checkoutInventoryService,
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
    pricing: checkoutPricingService,
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
          cart: createCheckoutCartPromiseFacade(services.cart),
          customer: services.customer,
          fulfillment: createFulfillmentPromiseServiceFromEffectService(
            services.fulfillment
          ),
          inventory: services.inventory,
          notificationEvent: services.notificationEvent,
          order: services.order,
          payment: services.payment,
          pricing: services.pricing,
          product: services.product,
          promotion: createCheckoutPromotionPromiseFacade(services.promotion),
          region: services.region,
          salesChannel: services.salesChannel,
          store: services.store,
          tax: createCheckoutTaxPromiseFacade(services.tax),
        }
      : undefined;
  const checkout = checkoutServices
    ? {
        ...checkoutServices,
        ...(createCartRepositoryForContext
          ? {
              createServiceOptionsForContext: (
                context: CheckoutModuleContext
              ) => ({
                ...checkoutServices,
                cart: createCheckoutCartPromiseFacade(
                  createCartService({
                    clock,
                    coordinator: cartCoordinator,
                    eventPublisher,
                    idGenerator,
                    repository: createCartRepositoryForContext(context),
                  })
                ),
              }),
            }
          : {}),
      }
    : undefined;

  const apiAssembly = createApiRootAssembly({
    routes: {
      ...(checkout ? { checkout } : {}),
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
    },
  });

  return {
    apiAssembly,
    checkoutConfigured: checkout !== undefined,
    repositories,
    services,
  };
};
