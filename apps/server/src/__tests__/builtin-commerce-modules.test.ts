import { describe, expect, it } from "bun:test";

import {
  adminHttpApi,
  createEffectHttpApiOpenApiSnapshot,
  storefrontHttpApi,
} from "@ecommerce/api";
import { CartRepositoryService, CartRuntimeAdapters } from "@ecommerce/cart";
import { CheckoutCompletionStore } from "@ecommerce/checkout";
import {
  ClockService,
  EventPublisherService,
  IdGeneratorService,
  KeyedActorService,
  MissingModuleDependencyError,
  OutboxWriterService,
  TransactionBoundaryService,
} from "@ecommerce/core";
import { CustomerRepositoryService } from "@ecommerce/customer";
import {
  FulfillmentProviderRegistryService,
  FulfillmentRepositoryService,
  emptyFulfillmentProviderRegistry,
} from "@ecommerce/fulfillment";
import { InventoryRepositoryService } from "@ecommerce/inventory";
import { NotificationEventRepositoryService } from "@ecommerce/notification-event";
import { OrderRepositoryService } from "@ecommerce/order";
import {
  PaymentProviderRegistryService,
  PaymentRepositoryService,
  emptyPaymentProviderRegistry,
} from "@ecommerce/payment";
import { PricingRepositoryService } from "@ecommerce/pricing";
import { ProductRepositoryService } from "@ecommerce/product";
import { PromotionRepositoryService } from "@ecommerce/promotion";
import {
  RegionRepositoryService,
  SalesChannelRepositoryService,
} from "@ecommerce/region-sales-channel";
import { StoreRepositoryService } from "@ecommerce/store";
import { TaxRepositoryService } from "@ecommerce/tax";
import { Effect, Layer } from "effect";

import {
  builtinCommerceModuleCatalog,
  composeBuiltinCommerceApplication,
} from "../builtin-commerce-modules";

describe("built-in executable commerce module catalog", () => {
  it("registers HTTP groups directly from each module definition", () => {
    const composition = composeBuiltinCommerceApplication();
    const declaredGroups = builtinCommerceModuleCatalog.flatMap(
      (module) => module.contributions.apiGroups ?? []
    );

    expect(declaredGroups).toHaveLength(composition.apiGroups.length);
    expect(composition.apiGroups.map(({ key }) => key).sort()).toEqual(
      declaredGroups.map(({ key }) => key).sort()
    );
    expect(composition.apiGroups.every(({ owner }) => owner === "module")).toBe(
      true
    );
  });

  it("does not maintain a parallel HTTP contribution catalog", async () => {
    const source = await Bun.file(
      new URL("../builtin-commerce-modules.ts", import.meta.url)
    ).text();

    expect(source).not.toContain("attachHttpGroups");
    expect(source).not.toMatch(/\w+EffectHttpApiContribution/);
    expect(source).not.toContain("defineCommerceModuleApiGroupContribution");
  });

  it("assembles admin and storefront routes and OpenAPI from registration", () => {
    const composition = composeBuiltinCommerceApplication();
    const snapshot = createEffectHttpApiOpenApiSnapshot({
      adminRoot: adminHttpApi,
      contributions: composition.apiGroups,
      storefrontRoot: storefrontHttpApi,
    });

    expect(
      snapshot.admin.assembly.routes.map(({ routeKey }) => routeKey)
    ).toContain("GET /admin/store");
    expect(
      snapshot.storefront.assembly.routes.map(({ routeKey }) => routeKey)
    ).toContain("GET /store/defaults");
    expect(snapshot.admin.assembly.handlers).toHaveLength(
      snapshot.admin.assembly.groups.length
    );
    expect(snapshot.storefront.assembly.handlers).toHaveLength(
      snapshot.storefront.assembly.groups.length
    );
    expect(snapshot.admin.document.paths["/admin/store"]?.get).toBeDefined();
    expect(
      snapshot.storefront.document.paths["/store/defaults"]?.get
    ).toBeDefined();
    expect(
      snapshot.storefront.document.paths["/admin/store"]?.get
    ).toBeUndefined();
  });

  it("validates every handler and acquires services without HTTP middleware", async () => {
    const composition = composeBuiltinCommerceApplication();
    const deterministicHostLayer = Layer.mergeAll(
      Layer.succeed(CartRepositoryService, {} as never),
      Layer.succeed(CartRuntimeAdapters, {}),
      Layer.succeed(CheckoutCompletionStore, {} as never),
      Layer.succeed(ClockService, {} as never),
      Layer.succeed(CustomerRepositoryService, {} as never),
      Layer.succeed(EventPublisherService, {} as never),
      Layer.succeed(
        FulfillmentProviderRegistryService,
        emptyFulfillmentProviderRegistry
      ),
      Layer.succeed(FulfillmentRepositoryService, {} as never),
      Layer.succeed(IdGeneratorService, {} as never),
      Layer.succeed(InventoryRepositoryService, {} as never),
      Layer.succeed(KeyedActorService, {} as never),
      Layer.succeed(NotificationEventRepositoryService, {} as never),
      Layer.succeed(OrderRepositoryService, {} as never),
      Layer.succeed(OutboxWriterService, {} as never),
      Layer.succeed(
        PaymentProviderRegistryService,
        emptyPaymentProviderRegistry
      ),
      Layer.succeed(PaymentRepositoryService, {} as never),
      Layer.succeed(PricingRepositoryService, {} as never),
      Layer.succeed(ProductRepositoryService, {} as never),
      Layer.succeed(PromotionRepositoryService, {} as never),
      Layer.succeed(RegionRepositoryService, {} as never),
      Layer.succeed(SalesChannelRepositoryService, {} as never),
      Layer.succeed(StoreRepositoryService, {} as never),
      Layer.succeed(TaxRepositoryService, {} as never),
      Layer.succeed(TransactionBoundaryService, {} as never)
    );
    const runnableApplicationLayer = composition.applicationLayer.pipe(
      Layer.provide(deterministicHostLayer)
    );

    await Effect.runPromise(
      Effect.void.pipe(Effect.provide(runnableApplicationLayer))
    );

    expect(composition.modules).toHaveLength(14);
    expect(composition.services).toHaveLength(15);
    expect(composition.apiGroups.length).toBeGreaterThanOrEqual(15);
    expect(composition.permissions.permissions.length).toBeGreaterThan(0);
    expect(composition.workflows.map(({ key }) => key)).toContain(
      "checkout.complete"
    );
  });

  it("removes every contribution when a module is disabled", () => {
    const withoutCheckout = composeBuiltinCommerceApplication({
      disabledModuleKeys: ["checkout"],
    });
    const openApi = createEffectHttpApiOpenApiSnapshot({
      contributions: withoutCheckout.apiGroups,
    });

    expect(withoutCheckout.byKey.has("checkout")).toBe(false);
    expect(
      withoutCheckout.apiGroups.some(({ key }) => key.includes("checkout"))
    ).toBe(false);
    expect(
      withoutCheckout.permissions.permissions.some(({ key }) =>
        key.startsWith("checkout:")
      )
    ).toBe(false);
    expect(
      withoutCheckout.services.some(({ key }) => key === "checkout:service")
    ).toBe(false);
    expect(
      builtinCommerceModuleCatalog.some(({ key }) => key === "checkout")
    ).toBe(true);
    expect(
      openApi.admin.document.paths["/admin/checkout/complete"]
    ).toBeUndefined();
  });

  it("rejects disabling a dependency while its dependants remain selected", () => {
    expect(() =>
      composeBuiltinCommerceApplication({
        disabledModuleKeys: ["store"],
      })
    ).toThrow(MissingModuleDependencyError);
  });
});
