## 1. Cart Cache Contracts

- [x] 1.1 Define runtime-neutral cart cache identity, ownership scope, and projection-sync types under `packages/modules/cart`.
- [x] 1.2 Add service/repository composition options so cart operations can use a platform-provided active cart cache without importing Cloudflare runtime types.
- [x] 1.3 Add module tests for visitor scope, customer scope, claim/association behavior, idempotency, and boundary-safe imports.

## 2. D1 Projection Sync

- [x] 2.1 Extend or wrap the existing D1 cart repository path so full cart aggregate projections can be upserted idempotently after cache mutations.
- [x] 2.2 Add tests for projection hydration, repeated projection writes, line item and adjustment idempotency, and missing projection recovery behavior.
- [x] 2.3 Document the D1 role as admin analytics/projection/recovery storage rather than the active cart mutation coordinator.

## 3. Cloudflare Durable Object Adapter

- [x] 3.1 Implement a cart Durable Object class in `packages/platform-cloudflare` for active aggregate storage, serialized mutation handling, ownership metadata, and pending D1 sync metadata.
- [x] 3.2 Implement a platform adapter factory that maps the cart module's runtime-neutral cache/projection contracts to the cart Durable Object namespace.
- [x] 3.3 Add platform-cloudflare tests for deterministic DO naming, cache hydration, mutation acceptance, duplicate idempotency keys, failed projection retry metadata, and visitor/customer isolation.

## 4. Infra and Server Composition

- [x] 4.1 Add a dedicated cart Durable Object namespace binding to the Cloudflare infra stack.
- [x] 4.2 Export the cart Durable Object class from `apps/server/src/index.ts` for Worker deployment.
- [x] 4.3 Import and inject `createD1CartRepository` in `apps/server/src/index.ts` and pass cart route options into `createApiRootAssembly({ routes })`.
- [x] 4.4 Wire the server cart route options to use the Cloudflare cart cache adapter and D1 projection repository.

## 5. Verification

- [x] 5.1 Add or update API/server assembly tests proving cart routes receive injected cache and D1 repository options in the Cloudflare runtime.
- [x] 5.2 Run targeted cart, API assembly, platform-cloudflare, infra, and server tests for the changed surfaces.
- [x] 5.3 Run repo-relevant typecheck and lint checks.
- [x] 5.4 Run `openspec status --change "add-cart-durable-object-cache"` and confirm all expected artifacts/tasks are tracked.
