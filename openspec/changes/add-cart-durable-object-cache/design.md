## Context

The cart module foundation already defines cart aggregates, line items, adjustments, totals snapshots, events, API fragments, coordination hooks, and a D1 repository adapter. The current Worker composition does not import or inject `createD1CartRepository`, so cart routes fall back to the module default repository instead of the deployed D1 adapter.

The platform also has accepted stateful runtime primitives: `packages/core` owns platform-free coordination contracts, and `packages/platform-cloudflare` owns Cloudflare Durable Object adapters. This change extends that pattern from generic coordination/idempotency into a cart-specific hot cache. The cart cache should play the Redis-like operational role that Medusa uses for active cart state, while D1 remains useful for admin analytics, projections, recovery, and reconciliation.

## Goals / Non-Goals

**Goals:**

- Add a Cloudflare Durable Object backed hot cache for active cart aggregates.
- Support both anonymous visitor carts and authenticated customer carts with explicit ownership scopes.
- Keep `packages/modules/cart` runtime-neutral by defining cache/projection contracts without Cloudflare imports.
- Hydrate cache state from D1 when needed and synchronize cart snapshots back to D1 after mutations.
- Wire `apps/server` to use the existing D1 cart repository adapter and the cart Durable Object cache adapter.
- Preserve the existing route fragment injection shape in `packages/api`.

**Non-Goals:**

- Replacing cart D1 tables or removing the D1 cart repository adapter.
- Moving checkout completion, order creation, payment capture, fulfillment, or inventory adjustments into cart.
- Adding a general-purpose Redis-compatible API.
- Allowing admin analytics queries to hit Durable Object storage directly.
- Introducing Cloudflare bindings into `packages/core`, `packages/api`, or pure commerce module logic.

## Decisions

### Use a cart-specific Durable Object cache instead of only the generic stateful coordinator

The generic `StatefulCoordinatorDurableObject` is suitable for idempotency and serialized coordination requests, but cart needs aggregate storage, hydration, ownership indexes, mutation replay protection, and D1 projection sync. A cart-specific Durable Object can keep those concerns local to the cart runtime adapter while still using platform-free contracts at the module boundary.

Alternative considered: reuse `STATEFUL_COORDINATOR` for every cart mutation and leave aggregate storage only in D1. That would serialize writes but keep D1 on the hot path and would not provide the Redis-like active cart cache requested for visitor/customer sessions.

### Keep cart cache contracts runtime-neutral

`packages/modules/cart` should expose typed ports for active cart cache operations and projection persistence, or adapt its existing repository/service options so a platform-provided repository can satisfy them. The module must not import `cloudflare:workers`, `DurableObjectNamespace`, Worker env types, or platform-cloudflare implementation files.

Alternative considered: put the Durable Object class under `packages/modules/cart`. That would make the module hard to test outside Cloudflare and conflict with accepted platform boundary requirements.

### Make Durable Objects the operational hot path and D1 the projection store

Cart reads and mutations should use Durable Objects for active carts. Each successful mutation stores the canonical active aggregate in the object and schedules or performs a projection write to the existing D1 cart tables. D1 remains the admin/reporting/read-model surface and the recovery source when a Durable Object has no cached aggregate.

Projection writes should be idempotent by cart id, line item id, adjustment id, and mutation/idempotency key. If D1 projection fails after the DO mutation succeeds, the DO must retain enough pending sync metadata to retry or reconcile without losing accepted cart state.

Alternative considered: write D1 first and update the Durable Object second. That makes D1 the real mutation coordinator and can leave the hot cache stale after accepted writes.

### Use explicit visitor and customer cache identities

The cache key should include the cart id and an actor scope. Anonymous carts use a visitor/session token scope. Authenticated carts use a customer/user scope. Claiming or associating a visitor cart to an authenticated customer must be an explicit mutation that updates ownership metadata and prevents the original visitor scope from being used to access another customer's cart after claim.

Alternative considered: key only by cart id. That is simpler but does not address cross-actor access and does not provide a deterministic lookup for "current visitor cart" or "current customer cart".

### Wire server composition with existing D1 cart repository

`apps/server/src/index.ts` should import `createD1CartRepository` and the cart D1 database type from the cart package, construct the repository from `database.db`, and pass cart route options into `createApiRootAssembly({ routes: { cart: ... } })`. The Cloudflare-specific cart cache adapter and Durable Object export should also be composed there, alongside infra binding updates.

Alternative considered: leave cart route fragments on defaults and add cache behavior inside the default service. That would hide production runtime dependencies behind module defaults and make tests/environment behavior diverge.

## Risks / Trade-offs

- Projection lag can make admin analytics briefly stale after a cart mutation. Mitigation: persist pending sync metadata in the Durable Object, make projection writes idempotent, and expose reconciliation tests/tooling.
- Durable Object state can become a second state model if D1 sync semantics are unclear. Mitigation: define DO as the active cart hot path and D1 as a projection/recovery store, with one documented sync direction for accepted mutations.
- Visitor-to-customer association is security-sensitive. Mitigation: require explicit scope metadata, authorization checks in route context, and tests that a visitor token or customer id cannot read or mutate another actor's cart.
- D1 writes from a Durable Object can increase mutation latency if performed synchronously. Mitigation: allow a sync policy that returns only after the DO state is accepted while retaining durable pending projection work for retry.
- Adding a second cart Durable Object namespace increases infrastructure surface area. Mitigation: keep it cart-specific, bind it explicitly, and verify Worker exports/bindings in server and infra tests.

## Migration Plan

1. Add runtime-neutral cart cache/projection contracts and tests under `packages/modules/cart`.
2. Add the Cloudflare cart Durable Object implementation and adapter factory under `packages/platform-cloudflare`.
3. Add a cart Durable Object namespace and Worker binding in `packages/infra`.
4. Export the new Durable Object class and inject the DO-backed cart cache plus `createD1CartRepository` in `apps/server/src/index.ts`.
5. Verify existing in-memory cart tests still pass and add integration-style tests for hydration, mutation serialization, idempotent projection sync, and visitor/customer ownership.

Rollback is to remove the server cart route override and fall back to the existing cart repository/service path. D1 projections remain compatible because the implementation reuses the existing cart tables.

## Open Questions

- Should projection retries run entirely inside the cart Durable Object alarm path, through an existing queue surface, or through an explicit admin reconciliation operation?
- Should authenticated users have exactly one active customer cart by default, or should the cache support multiple named active carts per customer from the start?
- Which request context field should provide the anonymous visitor scope: a signed cookie, a session id, or an explicit API token?
