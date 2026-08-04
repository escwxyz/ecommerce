import { describe, expect, it } from "bun:test";

import {
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import {
  createCachedCartRepository,
  createCustomerCartScope,
  createInMemoryCartActiveCache,
  createVisitorCartScope,
} from "../cache";
import { createCartId } from "../domain";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartService } from "../services";

const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));

describe("cart Effect active cache repository", () => {
  it("caches visitor carts and syncs accepted mutations to the projection repository", async () => {
    const projection = createResettableInMemoryCartRepository();
    const repository = createCachedCartRepository({
      cache: createInMemoryCartActiveCache(),
      projectionRepository: projection,
      scope: createVisitorCartScope("visitor_1"),
    });
    const service = createCartService({
      clock,
      idGenerator: createSequenceIdGenerator([
        "cart_cache",
        "evt_cart_cache",
        "clitem_cache",
        "evt_line_cache",
      ]),
      repository,
    });
    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );
    const aggregate = await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "visitor_line",
        idempotencyKey: "visitor_line",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat",
      })
    );

    await expect(
      Effect.runPromise(projection.getCartAggregate(cart.id))
    ).resolves.toMatchObject({
      cart: { id: cart.id },
      lineItems: [{ id: aggregate.lineItems[0]?.id }],
    });
  });

  it("hydrates a missing cache entry from the projection repository", async () => {
    const projection = createResettableInMemoryCartRepository();
    const service = createCartService({
      clock,
      idGenerator: createSequenceIdGenerator(["cart_seed", "evt_seed"]),
      repository: projection,
    });
    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );
    const hydratedRepository = createCachedCartRepository({
      cache: createInMemoryCartActiveCache(),
      projectionRepository: projection,
      scope: createVisitorCartScope("visitor_1"),
    });

    await expect(
      Effect.runPromise(hydratedRepository.getCartAggregate(cart.id))
    ).resolves.toMatchObject({ cart: { id: cart.id } });
    await expect(
      Effect.runPromise(
        hydratedRepository.getCartAggregate(createCartId("cart_missing"))
      )
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
    const cart = await Effect.runPromise(
      visitorService.createCart({ currencyCode: "USD" })
    );

    await expect(
      Effect.runPromise(otherCustomerRepository.getCartAggregate(cart.id))
    ).resolves.toBeNull();
    await Effect.runPromise(
      customerRepository.saveCart({
        ...cart,
        customerId: "cus_1",
        updatedAt: clock.now(),
      })
    );

    await expect(
      Effect.runPromise(customerRepository.getCartAggregate(cart.id))
    ).resolves.toMatchObject({
      cart: {
        customerId: "cus_1",
        id: cart.id,
      },
    });
    await expect(
      Effect.runPromise(visitorRepository.getCartAggregate(cart.id))
    ).resolves.toBeNull();
  });
});
