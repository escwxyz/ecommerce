## Context

`@ecommerce/checkout` already coordinates the public store, region/sales-channel, product, pricing, promotion, tax, inventory, customer, cart, payment, fulfillment, order, and notification/event service contracts. Its sequencing and compensation tests use stubs, while `@ecommerce/db-d1` verifies that deterministic prerequisite fixtures are connected across migrations. The remaining gap is runtime composition: `apps/server/src/index.ts` currently wires only store, region/sales-channel, product, pricing, promotion, inventory, cart, and notification/event routes. Customer, tax, payment, fulfillment, order, and checkout are absent, and order does not yet expose a D1 repository adapter.

The blueprint keeps the Worker as composition and transport only. Domain repositories remain module-owned, D1 remains the first runtime adapter, and Cloudflare-specific coordination must not leak into pure modules. The integration test must therefore exercise production-shaped module adapters and the Hono/oRPC server boundary without requiring a deployed Cloudflare stack or external provider credentials.

## Goals / Non-Goals

**Goals:**

- Make the complete checkout route available from the composed development server.
- Provide every checkout dependency through public module services backed by the shared D1/Kysely runtime.
- Complete the missing order D1 persistence adapter needed for post-checkout records.
- Exercise the golden path through the server transport using the deterministic seed and isolated storage.
- Verify persisted cross-module outcomes for cart, inventory, order, payment, fulfillment, and notification/event behavior.
- Keep the smoke test deterministic, credential-free, and part of normal local and CI verification.

**Non-Goals:**

- Integrate a production payment processor or fulfillment carrier.
- Change checkout sequencing, compensation policy, module ownership, or public API schemas except where a defect blocks the accepted path.
- Seed completed transaction history or authentication credentials.
- Replace Cloudflare Durable Object or Queue adapters with SQLite in the deployed runtime.
- Turn the credential-gated Alchemy deployment health test into a commerce data test.

## Decisions

1. **Extract a testable server commerce composition factory.**

   Move module repository/service/route assembly behind an `apps/server` factory that accepts the database, clock/id generation, stateful coordinators, notification runtime, and provider registries as explicit inputs. The Worker entry will adapt Cloudflare bindings into this factory, while the integration test will provide deterministic local implementations.

   Alternative considered: import `apps/server/src/index.ts` directly in tests. Rejected because that module eagerly reads Cloudflare bindings and creates Durable Object, Queue, and D1 resources that are unavailable in a normal Bun test.

   Alternative considered: duplicate route assembly in the test. Rejected because a passing duplicate would not prove the deployed Worker uses the same module graph.

2. **Use module-owned D1 repositories for every persistent participant.**

   Customer, tax, payment, fulfillment, cart, inventory, notification/event, pricing, product, promotion, region/sales-channel, and store will use their existing D1 adapters. Add a narrow order D1 adapter implementing the existing `OrderRepository` contract over the order migration tables, with the same repository contract coverage used by other modules. Because `kysely-d1` does not expose transactions, aggregate creation uses ordered parent/child writes and deletes the parent on failure so foreign-key cascades remove partial children.

   Alternative considered: keep order in memory while testing the rest against D1. Rejected because the smoke test must prove durable order creation and would otherwise miss the principal post-checkout record.

3. **Exercise the Hono/oRPC boundary, not only service callables.**

   The smoke test will build `createServerApp` from the extracted runtime assembly and issue requests through the application transport. It will create or prepare an active cart through public module procedures, associate the seeded customer and product variant, invoke `checkoutComplete`, and inspect the response before querying persistent outcomes.

   Alternative considered: call `createCheckoutService` directly. Rejected because the existing unit test already covers that level and does not detect missing server route composition, auth context, serialization, or transport failures.

4. **Reuse the exact migration and seed artifacts against isolated SQLite.**

   The test will apply the complete ordered D1 SQL migration directory and execute `generateDevelopmentSeedSql()` against a temporary in-memory SQLite database. Kysely will expose that database through the same table contracts consumed by D1 repositories. Each test owns and closes its database, making repeated and parallel runs independent.

   Alternative considered: run against a developer's Wrangler local database. Rejected because shared mutable state makes assertions order-dependent and can overwrite local work.

5. **Inject deterministic provider adapters explicitly and gate development providers.**

   Payment and fulfillment service construction will require explicit provider registries. The local test and development composition may register deterministic providers under the seed-compatible `manual` key. Production composition must not silently fall back to these providers; enabling them outside the isolated test requires an explicit development-mode configuration.

   Alternative considered: make fake providers the global service defaults. Rejected because a deployed checkout could appear successful without moving money or arranging fulfillment.

6. **Assert durable business outcomes, not only a 200 response.**

   After checkout, the smoke test will assert the returned order, payment, and fulfillment identifiers and verify corresponding order aggregate, payment collection/session/payment/capture, inventory reservation, fulfillment, cart checkout references/totals, and checkout notification/event records. It will also verify identifiers and relationships point back to the seeded product, customer, region, currency, stock location, and shipping option where applicable.

7. **Keep local commerce smoke coverage separate from deployed health coverage.**

   The golden-path test will run from the server package's ordinary `test` task so regressions fail without Cloudflare credentials. `packages/infra/alchemy.integration.test.ts` remains a credential-gated deployment/health check and does not become the only place commerce behavior is tested.

## Risks / Trade-offs

- [Risk] SQLite compatibility can pass while a Cloudflare binding-specific defect remains. -> Mitigation: use the actual D1 repository implementations and keep the existing deployed-stack test; add a remote commerce smoke only when credentials and isolated teardown are available.
- [Risk] Extracting server composition can accidentally move domain logic into `apps/server`. -> Mitigation: keep the factory limited to constructing repositories, providers, services, route options, and runtime adapters; module behavior remains in packages.
- [Risk] Provider keys in seed data and runtime registries can drift. -> Mitigation: share or assert the reserved `manual` provider key in the smoke test and fail composition when a required provider is absent.
- [Risk] The test can become brittle if it asserts every table column. -> Mitigation: assert module-level records, statuses, totals, idempotency keys, and foreign-key relationships required by the golden path rather than incidental storage formatting.
- [Risk] Checkout's process-local completion cache does not prove retry safety across Worker isolates. -> Mitigation: retain repository-level idempotency assertions and record cross-isolate checkout idempotency as a separate follow-up unless implementation exposes a blocking duplicate-write defect.

## Migration Plan

1. Add repository contract tests and the order D1 adapter before changing server composition.
2. Extract the server commerce composition factory while preserving existing Worker binding behavior.
3. Add all missing D1 repositories, provider registries, service dependencies, and checkout route options to the factory.
4. Add the isolated migration/seed/server harness and the golden-path smoke test to the normal server test task.
5. Run targeted module tests, server tests, typechecks, static checks, and the root test suite; retain the credential-gated Alchemy test as separate evidence.
6. Roll back by restoring the prior Worker assembly and removing the new integration harness; no schema rollback is required because the order tables already exist and the adapter introduces no migration.

## Open Questions

None. Production payment and fulfillment provider selection remains a separate provider-integration change; this change only requires explicit deterministic development/test providers.
