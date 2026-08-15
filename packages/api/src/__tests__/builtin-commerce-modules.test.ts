import { describe, expect, it } from "bun:test";

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
import { FulfillmentRepositoryService } from "@ecommerce/fulfillment";
import { InventoryRepositoryService } from "@ecommerce/inventory";
import { NotificationEventRepositoryService } from "@ecommerce/notification-event";
import { OrderRepositoryService } from "@ecommerce/order";
import { PaymentRepositoryService } from "@ecommerce/payment";
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
  it("validates every handler and acquires services without HTTP middleware", async () => {
    const composition = composeBuiltinCommerceApplication();
    const deterministicHostLayer = Layer.mergeAll(
      Layer.succeed(CartRepositoryService, {} as never),
      Layer.succeed(CartRuntimeAdapters, {}),
      Layer.succeed(CheckoutCompletionStore, {} as never),
      Layer.succeed(ClockService, {} as never),
      Layer.succeed(CustomerRepositoryService, {} as never),
      Layer.succeed(EventPublisherService, {} as never),
      Layer.succeed(FulfillmentRepositoryService, {} as never),
      Layer.succeed(IdGeneratorService, {} as never),
      Layer.succeed(InventoryRepositoryService, {} as never),
      Layer.succeed(KeyedActorService, {} as never),
      Layer.succeed(NotificationEventRepositoryService, {} as never),
      Layer.succeed(OrderRepositoryService, {} as never),
      Layer.succeed(OutboxWriterService, {} as never),
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
  });

  it("rejects disabling a dependency while its dependants remain selected", () => {
    expect(() =>
      composeBuiltinCommerceApplication({
        disabledModuleKeys: ["store"],
      })
    ).toThrow(MissingModuleDependencyError);
  });
});
