import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";

import {
  createCachedCartRepository,
  createCustomerCartScope,
  createInMemoryCartActiveCache,
  createVisitorCartScope,
} from "../cache";
import type { CartProjectionSyncFailure } from "../cache";
import { createCartId } from "../domain";
import type { CartRepository } from "../domain";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartService } from "../services";

const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));

const createService = ({
  projection = createResettableInMemoryCartRepository(),
  scope,
  syncFailures,
}: {
  readonly projection?: CartRepository;
  readonly scope: ReturnType<typeof createVisitorCartScope>;
  readonly syncFailures?: CartProjectionSyncFailure[];
}) => {
  const repository = createCachedCartRepository({
    cache: createInMemoryCartActiveCache(),
    onProjectionSyncFailure: (failure) => {
      syncFailures?.push(failure);
    },
    projectionRepository: projection,
    scope,
  });

  return {
    projection,
    repository,
    service: createCartService({
      clock,
      idGenerator: createSequenceIdGenerator([
        "cart_cache",
        "evt_cart_cache",
        "clitem_cache",
        "evt_line_cache",
        "cadj_cache",
        "evt_adjustment_cache",
      ]),
      repository,
    }),
  };
};

describe("cart active cache repository", () => {
  it("caches visitor carts and syncs accepted mutations to the projection repository", async () => {
    const { projection, service } = createService({
      scope: createVisitorCartScope("visitor_1"),
    });
    const cart = await service.createCart({ currencyCode: "USD" });
    const aggregate = await service.addLineItem({
      cartId: cart.id,
      correlationId: "visitor_line",
      idempotencyKey: "visitor_line",
      productId: "prod_hat",
      quantity: 1,
      title: "Hat",
      unitPrice: 1200,
      variantId: "variant_hat",
    });
    const duplicate = await service.addLineItem({
      cartId: cart.id,
      correlationId: "visitor_line",
      idempotencyKey: "visitor_line",
      productId: "prod_hat",
      quantity: 1,
      title: "Hat",
      unitPrice: 1200,
      variantId: "variant_hat",
    });

    await expect(projection.getCartAggregate(cart.id)).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
      lineItems: [
        {
          id: aggregate.lineItems[0]?.id,
        },
      ],
    });
    expect(duplicate.lineItems).toHaveLength(1);
  });

  it("hydrates a missing cache entry from the projection repository", async () => {
    const projection = createResettableInMemoryCartRepository();
    const { service } = createService({
      projection,
      scope: createVisitorCartScope("visitor_1"),
    });
    const cart = await service.createCart({ currencyCode: "USD" });
    const hydratedRepository = createCachedCartRepository({
      cache: createInMemoryCartActiveCache(),
      projectionRepository: projection,
      scope: createVisitorCartScope("visitor_1"),
    });

    await expect(
      hydratedRepository.getCartAggregate(cart.id)
    ).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
    });
    await expect(
      hydratedRepository.getCartAggregate(createCartId("cart_missing"))
    ).resolves.toBeNull();
  });

  it("enforces visitor and customer ownership scopes with explicit claim", async () => {
    const cache = createInMemoryCartActiveCache();
    const projection = createResettableInMemoryCartRepository();
    const visitorRepository = createCachedCartRepository({
      cache,
      projectionRepository: projection,
      scope: createVisitorCartScope("visitor_1"),
    });
    const customerRepository = createCachedCartRepository({
      cache,
      projectionRepository: projection,
      scope: createCustomerCartScope("cus_1"),
    });
    const otherCustomerRepository = createCachedCartRepository({
      cache,
      projectionRepository: projection,
      scope: createCustomerCartScope("cus_2"),
    });
    const visitorService = createCartService({
      clock,
      idGenerator: createSequenceIdGenerator(["cart_claim", "evt_claim"]),
      repository: visitorRepository,
    });
    const cart = await visitorService.createCart({ currencyCode: "USD" });

    await expect(
      otherCustomerRepository.getCartAggregate(cart.id)
    ).resolves.toBeNull();
    await customerRepository.saveCart({
      ...cart,
      customerId: "cus_1",
      updatedAt: clock.now(),
    });

    await expect(
      customerRepository.getCartAggregate(cart.id)
    ).resolves.toMatchObject({
      cart: {
        customerId: "cus_1",
        id: cart.id,
      },
    });
    await expect(
      visitorRepository.getCartAggregate(cart.id)
    ).resolves.toBeNull();
  });

  it("retains pending projection failure metadata for retry or reconciliation", async () => {
    const failures: CartProjectionSyncFailure[] = [];
    const failingProjection = createResettableInMemoryCartRepository();
    failingProjection.saveCart = async () => {
      throw new Error("projection unavailable");
    };
    const { service } = createService({
      projection: failingProjection,
      scope: createVisitorCartScope("visitor_1"),
      syncFailures: failures,
    });
    const cart = await service.createCart({ currencyCode: "USD" });

    await expect(service.getCart(cart.id)).resolves.toMatchObject({
      cart: {
        id: cart.id,
      },
    });
    expect(failures).toEqual([
      expect.objectContaining({
        cartId: cart.id,
        reason: "projection unavailable",
      }),
    ]);
  });
});
