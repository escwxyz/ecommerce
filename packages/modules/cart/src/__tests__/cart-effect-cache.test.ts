import { describe, expect, it } from "bun:test";

import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
  createSequenceIdGenerator,
  createStaticClock,
} from "@ecommerce/core/testing";
import { Effect } from "effect";

import {
  createCachedCartRepository,
  createCartMutationCacheCoordinator,
  createCommittedCartCacheSynchronizer,
  createCustomerCartScope,
  createVisitorCartScope,
} from "../cache";
import { createInMemoryCartActorService } from "../coordination";
import { CartValidationFailure, createCartId } from "../domain";
import { createResettableInMemoryCartRepository } from "../repositories";
import { createCartService } from "../services";
import { createInMemoryCartActiveCache } from "../testing";

const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));
const createCacheTestCart = (id: string) => ({
  billingAddress: null,
  completedAt: null,
  createdAt: clock.now(),
  currencyCode: "USD",
  customerId: null,
  email: null,
  id: createCartId(id),
  metadata: {},
  paymentCollectionId: null,
  regionId: null,
  salesChannelId: null,
  shippingAddress: null,
  shippingOptionId: null,
  status: "active" as const,
  totals: {
    adjustmentTotal: 0,
    currencyCode: "USD",
    discountTotal: 0,
    giftCardTotal: 0,
    itemSubtotal: 0,
    shippingTotal: 0,
    subtotal: 0,
    taxTotal: 0,
    total: 0,
  },
  updatedAt: clock.now(),
});
const createMutationPersistence = () => {
  const outbox = createInMemoryOutbox();
  return {
    outboxWriter: outbox.writer,
    transactionBoundary: createInMemoryTransactionBoundary({
      resources: [outbox],
    }),
  };
};

describe("cart Effect active cache repository", () => {
  it("synchronizes committed PostgreSQL mutations into the active cache with idempotency", async () => {
    const cache = createInMemoryCartActiveCache();
    const projection = createResettableInMemoryCartRepository();
    const scope = createVisitorCartScope("visitor_1");
    const repository = createCachedCartRepository({
      cache,
      projectionRepository: projection,
      scope,
    });
    const outbox = createInMemoryOutbox();
    const service = createCartService({
      actorService: createInMemoryCartActorService(),
      clock,
      committedMutationSynchronizer: createCommittedCartCacheSynchronizer({
        cache,
        projectionRepository: projection,
        scope,
      }),
      idGenerator: createSequenceIdGenerator([
        "cart_committed_cache",
        "evt_cart_committed_cache",
        "clitem_committed_cache",
        "evt_line_committed_cache",
      ]),
      mutationCacheCoordinator: createCartMutationCacheCoordinator({
        cache,
        scope,
      }),
      mutationRepository: projection,
      outboxWriter: outbox.writer,
      repository,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [projection, outbox],
      }),
    });
    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );

    await Effect.runPromise(
      service.addLineItem({
        cartId: cart.id,
        correlationId: "committed_line",
        idempotencyKey: "committed_line",
        productId: "prod_hat",
        quantity: 1,
        title: "Hat",
        unitPrice: 1200,
        variantId: "variant_hat",
      })
    );

    await expect(
      Effect.runPromise(
        cache.findLineItemByIdempotencyKey({
          idempotencyKey: "committed_line",
          scope,
        })
      )
    ).resolves.toMatchObject({ cartId: cart.id, productId: "prod_hat" });
    await expect(
      Effect.runPromise(service.getCart(cart.id))
    ).resolves.toMatchObject({
      cart: { id: cart.id },
      lineItems: [{ productId: "prod_hat" }],
    });
  });

  it("does not synchronize the active cache when the PostgreSQL transaction rolls back", async () => {
    const cache = createInMemoryCartActiveCache();
    const projection = createResettableInMemoryCartRepository();
    const scope = createVisitorCartScope("visitor_rollback");
    const outbox = createInMemoryOutbox();
    const service = createCartService({
      actorService: createInMemoryCartActorService(),
      clock,
      committedMutationSynchronizer: createCommittedCartCacheSynchronizer({
        cache,
        projectionRepository: projection,
        scope,
      }),
      idGenerator: createSequenceIdGenerator([
        "cart_rollback_cache",
        "evt_rollback_cache",
      ]),
      mutationCacheCoordinator: createCartMutationCacheCoordinator({
        cache,
        scope,
      }),
      mutationRepository: projection,
      outboxWriter: outbox.writer,
      repository: createCachedCartRepository({
        cache,
        projectionRepository: projection,
        scope,
      }),
      transactionBoundary: createInMemoryTransactionBoundary({
        failCommit: true,
        resources: [projection, outbox],
      }),
    });

    await expect(
      Effect.runPromise(service.createCart({ currencyCode: "USD" }))
    ).rejects.toBeDefined();
    await expect(
      Effect.runPromise(
        cache.getCartAggregate({
          id: createCartId("cart_rollback_cache"),
          scope,
        })
      )
    ).resolves.toBeNull();
  });

  it("reads cached aggregates again after the final active mutation completes", async () => {
    const cache = createInMemoryCartActiveCache();
    const scope = createVisitorCartScope("visitor_final_mutation");
    const cartId = createCartId("cart_final");
    const now = new Date("2026-01-01T00:00:00.000Z");

    await Effect.runPromise(
      cache.saveCart({
        cart: {
          billingAddress: null,
          completedAt: null,
          createdAt: now,
          currencyCode: "USD",
          customerId: null,
          email: null,
          id: cartId,
          metadata: {},
          paymentCollectionId: null,
          regionId: null,
          salesChannelId: null,
          shippingAddress: null,
          shippingOptionId: null,
          status: "active",
          totals: {
            adjustmentTotal: 0,
            currencyCode: "USD",
            discountTotal: 0,
            giftCardTotal: 0,
            itemSubtotal: 0,
            shippingTotal: 0,
            subtotal: 0,
            taxTotal: 0,
            total: 0,
          },
          updatedAt: now,
        },
        scope,
      })
    );
    await Effect.runPromise(
      cache.beginMutation({
        cartId,
        mutationId: "mut_final",
        scope,
      })
    );
    await expect(
      Effect.runPromise(cache.getCartAggregate({ id: cartId, scope }))
    ).resolves.toBeNull();

    await Effect.runPromise(
      cache.completeMutation({
        cartId,
        mutationId: "mut_final",
        scope,
      })
    );

    await expect(
      Effect.runPromise(cache.getCartAggregate({ id: cartId, scope }))
    ).resolves.toMatchObject({ cart: { id: cartId } });
  });

  it("evaluates a preconstructed cart lookup after a mutation begins", async () => {
    const cache = createInMemoryCartActiveCache();
    const scope = createVisitorCartScope("visitor_deferred_cart");
    const cart = createCacheTestCart("cart_deferred_lookup");
    await Effect.runPromise(
      cache.saveCart({
        cart,
        scope,
      })
    );
    const pendingLookup = cache.findCartById({ id: cart.id, scope });

    await Effect.runPromise(
      cache.beginMutation({
        cartId: cart.id,
        mutationId: "mut_deferred_cart",
        scope,
      })
    );

    await expect(Effect.runPromise(pendingLookup)).resolves.toBeNull();
  });

  it("evaluates a preconstructed aggregate lookup after a mutation begins", async () => {
    const cache = createInMemoryCartActiveCache();
    const scope = createVisitorCartScope("visitor_deferred_aggregate");
    const cart = createCacheTestCart("cart_deferred_aggregate");
    await Effect.runPromise(cache.saveCart({ cart, scope }));
    const pendingLookup = cache.getCartAggregate({ id: cart.id, scope });

    await Effect.runPromise(
      cache.beginMutation({
        cartId: cart.id,
        mutationId: "mut_deferred_aggregate",
        scope,
      })
    );

    await expect(Effect.runPromise(pendingLookup)).resolves.toBeNull();
  });

  it("defers preconstructed hydration while a mutation is active", async () => {
    const cache = createInMemoryCartActiveCache();
    const scope = createVisitorCartScope("visitor_deferred_hydration");
    const cart = createCacheTestCart("cart_deferred_hydration");
    const pendingHydration = cache.hydrateCartAggregate({
      aggregate: { adjustments: [], cart, lineItems: [] },
      scope,
    });

    await Effect.runPromise(
      cache.beginMutation({
        cartId: cart.id,
        mutationId: "mut_deferred_hydration",
        scope,
      })
    );
    await Effect.runPromise(pendingHydration);

    await expect(
      Effect.runPromise(cache.getCartAggregate({ id: cart.id, scope }))
    ).resolves.toBeNull();
  });

  it("records cache failures without failing an already committed mutation", async () => {
    const projection = createResettableInMemoryCartRepository();
    const baseCache = createInMemoryCartActiveCache();
    let recordedFailures = 0;
    const cache = {
      ...baseCache,
      recordProjectionSyncFailure: () =>
        Effect.sync(() => {
          recordedFailures += 1;
        }),
      saveCart: () =>
        Effect.fail(
          new CartValidationFailure({ message: "Cart cache unavailable." })
        ),
    };
    const outbox = createInMemoryOutbox();
    const service = createCartService({
      actorService: createInMemoryCartActorService(),
      clock,
      committedMutationSynchronizer: createCommittedCartCacheSynchronizer({
        cache,
        projectionRepository: projection,
      }),
      idGenerator: createSequenceIdGenerator([
        "cart_cache_failure",
        "evt_cache_failure",
      ]),
      mutationRepository: projection,
      outboxWriter: outbox.writer,
      repository: projection,
      transactionBoundary: createInMemoryTransactionBoundary({
        resources: [projection, outbox],
      }),
    });

    const cart = await Effect.runPromise(
      service.createCart({ currencyCode: "USD" })
    );

    expect(recordedFailures).toBe(1);
    await expect(
      Effect.runPromise(projection.findCartById(cart.id))
    ).resolves.toMatchObject({ id: cart.id });
  });

  it("caches visitor carts and syncs accepted mutations to the projection repository", async () => {
    const projection = createResettableInMemoryCartRepository();
    const repository = createCachedCartRepository({
      cache: createInMemoryCartActiveCache(),
      projectionRepository: projection,
      scope: createVisitorCartScope("visitor_1"),
    });
    const service = createCartService({
      ...createMutationPersistence(),
      actorService: createInMemoryCartActorService(),
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
      ...createMutationPersistence(),
      actorService: createInMemoryCartActorService(),
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
      ...createMutationPersistence(),
      actorService: createInMemoryCartActorService(),
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
