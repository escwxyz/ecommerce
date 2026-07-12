# Effect Service and Layer Conventions

Backend dependencies use Effect 4 `Context.Service` contracts and `Layer`
implementations. Public operations return `Effect<A, E, R>` so success,
expected failure, and remaining requirements stay visible to TypeScript.

## Service boundaries

- Create services only for replaceable domain, module, repository, provider,
  platform-resource, request, transaction, runtime, or test boundaries.
- Keep deterministic calculations as ordinary pure functions.
- Use globally unique service identifiers prefixed with `@ecommerce/<package>/`.
- Service methods return Effects. Do not expose `Promise | value`, mutable
  globals, Cloudflare bindings, Drizzle databases, or transaction handles from
  runtime-neutral contracts.
- Name important operations with `Effect.fn("Service.operation")` so tracing
  and stack information identify the business boundary.

## Modules and adapters

Module services depend on narrow contracts such as repositories and providers.
Concrete PostgreSQL, Cloudflare, provider, and test implementations are Layers
owned by their adapter packages. Construct a dependent module with
`Layer.effect`; satisfy and hide implementation dependencies with
`Layer.provide`. Use `Layer.provideMerge` only when downstream composition must
also retain the dependency service.

Do not create a universal database, provider, or platform service. Modules
declare the capability they use, while composition roots select concrete
Layers.

## Request scope and transactions

Request identity, permissions, correlation data, deadlines, and similar values
are provided as a fresh request Layer. They must never be stored in module
singletons or mutable globals.

Application services own transaction boundaries. Transaction-scoped database
services are acquired with scoped Effect resource management and provided only
to repositories participating in that local transaction. Domain APIs never
accept or return a transaction handle. Cross-module coordination uses workflows,
not a shared transaction Layer.

## Composition roots

Leaf packages export contracts and implementation Layers but do not run a
runtime. `apps/server` selects Cloudflare Layers and provides them to the
assembled application. Tests select deterministic or in-memory Layers. Avoid
module-level `Effect.run*` calls outside explicit application, command, or test
composition roots.

## Tests

Place new tests in a nested `__tests__/` folder. Every runtime-neutral service
must demonstrate that production and test Layers can run the same business
program without global mutation or platform bindings. Scoped resources must
test acquisition, use, release, and failure/interruption cleanup where
applicable.
