## 1. Effect 4 dependency governance and canary

- [x] 1.1 Select and document the reviewed Effect 4 beta release/revision and compatible package set from `effect-smol`
- [x] 1.2 Replace workspace Effect dependency ranges with exact root-catalog pins and refresh the lockfile
- [x] 1.3 Add the Effect 4 compiler and TypeScript configuration required by the selected release
- [x] 1.4 Add a Schema and schema-backed tagged-error canary test
- [x] 1.5 Add a service, Layer, scope, configuration, and telemetry canary test
- [x] 1.6 Add an Effect `HttpApi` and generated OpenAPI canary test
- [x] 1.7 Add an Effect SQL PostgreSQL plus Drizzle query, transaction, and row-decoding canary test
- [x] 1.8 Add a Cloudflare Worker startup canary for the selected Effect HTTP adapter
- [x] 1.9 Document the dedicated Effect upgrade workflow and full verification command set

## 2. Backend conventions and boundaries

- [x] 2.1 Define package-level conventions for domain, API, and storage Effect Schemas and transformations
- [x] 2.2 Define schema-backed module error conventions and Cause-aware defect/interruption handling
- [x] 2.3 Define Effect service and Layer conventions for modules, adapters, request scope, transactions, and tests
- [x] 2.4 Define Effect Config and Redacted conventions for environment values and secrets
- [x] 2.5 Define structured logging, span, metric, correlation, redaction, and audit conventions
- [x] 2.6 Provide deterministic clock, ID, configuration, telemetry, and repository test Layers
- [x] 2.7 Add import-boundary helpers that can ban Hono, oRPC, Zod, Kysely, and Cloudflare per migrated package
- [x] 2.8 Update shared JSDoc and architecture comments for the new Effect boundaries

## 3. Effect SQL PostgreSQL and Drizzle foundation

- [x] 3.1 Define runtime-neutral repository, transaction, migration, and outbox service contracts
- [x] 3.2 Implement the Effect PostgreSQL client and Drizzle database Layers with scoped connection/transaction behavior
- [x] 3.3 Implement the clean PostgreSQL Drizzle schema, migration baseline, and migration runner
- [x] 3.4 Implement migration status, failure, rollback-development, and reset-development commands
- [x] 3.5 Build the in-memory repository contract harness and local PostgreSQL contract harness
- [x] 3.6 Implement transactional outbox persistence and claiming primitives
- [x] 3.7 Remove Kysely types from shared database contracts used by newly migrated code
- [x] 3.8 Verify PostgreSQL migrations, transactions, constraint failures, row decoding, and concurrent outbox claims
- [x] 3.9 Provision the Cloudflare PostgreSQL connectivity resource and verify the first Hyperdrive-backed Worker connection

## 4. Effect HTTP and storefront SDK foundation

- [x] 4.1 Define canonical admin and storefront `HttpApi` roots and module group contribution contracts
- [x] 4.2 Define shared pagination, request identity, success, and serialized error schemas
- [x] 4.3 Implement Effect HTTP middleware for request context, auth provision, permissions, telemetry, deadlines, and sanitized defects
- [x] 4.4 Implement deterministic API assembly and duplicate method/path detection
- [x] 4.5 Implement the Cloudflare Worker Effect HTTP entrypoint and runtime Layer composition
- [x] 4.6 Generate and snapshot OpenAPI from the canonical Effect API
- [x] 4.7 Create the storefront SDK package and browser HTTP transport
- [x] 4.8 Implement the server-only Cloudflare Service Binding SDK transport
- [x] 4.9 Add shared conformance tests proving HTTP and Service Binding transport parity
- [x] 4.10 Add browser-bundle boundary tests that prohibit server runtime and Cloudflare binding exports

## 5. Authentication boundary

- [x] 5.1 Define Effect Schema identity, session, role, permission, and auth error contracts
- [x] 5.2 Define the Effect-native `AuthService` and request-auth context services
- [x] 5.3 Wrap existing Better Auth behavior in a private Effect adapter Layer
- [x] 5.4 Translate Better Auth requests, results, and failures without leaking Better Auth types
- [x] 5.5 Integrate the auth adapter with Effect HTTP middleware and protected API groups
- [x] 5.6 Determine and document the temporary auth persistence seam needed during Kysely removal
- [x] 5.7 Add auth boundary, session, cookie, permission, and sanitized-error tests on Cloudflare
- [x] 5.8 Create a follow-up research change comparing direct wrapping, `effectify`, and future official support

## 6. Store tracer vertical slice

- [x] 6.1 Lock current store behavior and invariants with framework-independent regression tests
- [x] 6.2 Replace store domain Zod schemas and inferred types with domain/API/storage Effect Schemas
- [x] 6.3 Replace generic store errors with schema-backed tagged errors
- [x] 6.4 Replace the store service and dependencies with Effect 4 services and Layers
- [x] 6.5 Implement the store repository contract and in-memory test Layer
- [x] 6.6 Implement store Drizzle PostgreSQL schemas, codecs, migrations, transactions, and repository Layer
- [x] 6.7 Replace the store oRPC router with Effect admin/storefront API groups and handlers
- [x] 6.8 Add store SDK coverage through both storefront transports
- [x] 6.9 Delete store Zod, Kysely, and oRPC code and enable completed-package import bans
- [x] 6.10 Run store domain, schema, repository, API, SDK, boundary, and Cloudflare integration verification

## 7. Foundational module migration

- [x] 7.1 Migrate customer end-to-end and delete its legacy schema, repository, migration, and router path
- [x] 7.2 Migrate product end-to-end and delete its legacy schema, repository, migration, and router path
- [x] 7.3 Migrate region and sales-channel end-to-end and delete their legacy paths
- [x] 7.4 Migrate pricing end-to-end and delete its legacy path
- [x] 7.5 Migrate inventory end-to-end and delete its legacy path
- [x] 7.6 Run shared foundational-module repository, API, SDK, permission, boundary, and Cloudflare suites

## 8. Transactional module migration

- [x] 8.1 Migrate cart end-to-end, including cache/actor ports, and delete its legacy path
- [x] 8.2 Migrate promotion end-to-end and delete its legacy path
- [x] 8.3 Migrate tax end-to-end and delete its legacy path
- [x] 8.4 Migrate fulfillment and its provider boundary end-to-end and delete its legacy path
- [x] 8.5 Migrate payment and its provider boundary end-to-end and delete its legacy path
- [x] 8.6 Migrate checkout orchestration boundaries and delete its legacy API/schema path
- [x] 8.7 Migrate order end-to-end and delete its legacy path
- [x] 8.8 Migrate notification-event end-to-end and delete its legacy path
- [x] 8.9 Run cross-module commerce golden-path, failure, permission, and concurrency suites

## 9. Durable workflows, outbox, queues, and actors

- [x] 9.1 Define schema-versioned workflow definitions, state, step outcomes, retry, and compensation contracts
- [x] 9.2 Implement the deterministic in-memory workflow runtime and recovery test harness
- [x] 9.3 Implement Cloudflare workflow/queue runtime Layers with typed failures and telemetry
- [x] 9.4 Integrate transactional outbox claiming and idempotent queue delivery
- [x] 9.5 Define platform-neutral keyed actor, command, timer, and state ownership contracts
- [x] 9.6 Implement the Durable Object actor Layer and Effect Schema message boundary
- [x] 9.7 Evaluate Effect SQL Durable Object SQLite for applicable actor-local state
- [x] 9.8 Document PostgreSQL versus actor-local ownership for every stateful workload
- [x] 9.9 Verify interruption, retry, replay, duplicate delivery, compensation, actor restart, and timer recovery
- [x] 9.10 Create a deferred Rivet parity-evaluation change with consistency, recovery, operations, latency, and cost criteria

## 10. Effect-native plugin architecture

- [x] 10.1 Replace native plugin manifests with Effect Schemas and runtime-neutral capability declarations
- [x] 10.2 Replace native plugin service/provider/API/workflow/event contributions with Effect contracts and Layers
- [x] 10.3 Add deterministic native plugin validation, composition, lifecycle, and telemetry tests
- [x] 10.4 Replace sandbox manifest and bridge request/response schemas with Effect Schema
- [x] 10.5 Implement Effect-hosted capability bridge services with grants, typed failures, deadlines, quotas, and audit events
- [x] 10.6 Prohibit host runtime, SQL, secrets, and raw binding exposure through sandbox boundary tests
- [x] 10.7 Adapt Worker Loader execution to the new bridge contract
- [x] 10.8 Verify sandbox activation, malformed messages, capability denial, egress, storage isolation, timeout, and defect handling

## 11. Observability and operations

- [x] 11.1 Select and implement the first Cloudflare telemetry exporter Layer
- [ ] 11.2 Propagate correlation and trace context across HTTP, Service Bindings, SQL, workflows, queues, actors, plugins, and providers
- [ ] 11.3 Add shared redaction and attribute-cardinality policies
- [ ] 11.4 Add metrics that distinguish typed rejections, defects, interruptions, retries, compensation, and poison messages
- [ ] 11.5 Verify telemetry exporter failure does not fail ordinary commerce operations
- [ ] 11.6 Verify required security and commerce audit records use their explicit durable persistence contract

## 12. Legacy removal and completion audit

- [ ] 12.1 Remove backend Hono routes, middleware, dependencies, and server composition
- [ ] 12.2 Remove backend oRPC routers, procedures, clients, dependencies, and generated type coupling
- [ ] 12.3 Remove backend Zod schemas, converters, dependencies, and unchecked compatibility casts
- [ ] 12.4 Remove Kysely database types, repositories, dialect helpers, migrations, dependencies, and adapter packages
- [ ] 12.5 Remove every completed temporary bridge and verify no new code depends on one
- [ ] 12.6 Enable repository-wide backend forbidden-import and server-only SDK boundary checks
- [ ] 12.7 Reset and seed a clean local PostgreSQL database solely through Drizzle and Effect tooling
- [ ] 12.8 Run formatting, lint, typecheck, unit, contract, API, SDK, workflow, plugin, build, and credential-free Cloudflare smoke suites
- [ ] 12.9 Update the roadmap, stateful runtime guide, package documentation, active OpenSpec task state, and project memory to match the implemented architecture
- [ ] 12.10 Run `openspec status --change "adopt-effect-4-backend-architecture"` and complete a requirement-by-requirement evidence audit
