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

## Trusted native plugins

Trusted native-plugin manifests remain serializable data, while executable
contributions use the contracts exported from `@ecommerce/core/plugins`:

- service and provider contributions pair a portable `Context.Service` tag with
  the Layer that implements it;
- API contributions carry an Effect `HttpApiGroup` plus its handler Layer and
  identify the admin or storefront surface;
- workflow steps retain their typed Effect failures and requirements, and the
  workflow contribution supplies the Layer for those requirements;
- event handlers return `Effect<void, E, R>` and declare the Layer that
  satisfies `R`.

Concrete provider SDKs, Cloudflare bindings, SQL clients, and secrets stay
inside adapter Layers. Plugin registration and composition must preserve
concrete tag and Layer types; heterogeneous registries use the closed
contribution `_tag` vocabulary rather than erasing executable values to `any`.
Hosts call `composeNativePlugins` with their available portable capability keys;
only active plugins are composed, in stable plugin-ID order, after required
capabilities and contribution identities validate. Lifecycle hosts use
`transitionNativePlugin` or `transitionNativePlugins`, which advance state only
after successful hooks and wrap execution in correlated `plugin.lifecycle`
Effect telemetry. The multi-plugin dispatcher is sequential by plugin ID so
install, activation, upgrade, deactivation, and uninstall behavior does not
depend on discovery order.

Sandbox bridge hosts use `SandboxCapabilityBridgeService` rather than passing
host resources directly to plugin code. The service decodes bridge context and
operation messages, checks granted capabilities, deadlines, and quotas, records
allow/deny decisions through `DurableAudit`, and only then invokes the
host-supplied Effect handler. Handler implementations stay in platform adapter
Layers and must not expose SQL clients, raw Cloudflare bindings, secrets, or the
host Effect runtime to sandboxed plugins. Sandbox storage namespaces are
plugin-local names, not host resources; reserved names such as `binding`,
`cloudflare`, `runtime`, `secret`, `secrets`, and `sql` are rejected at the
Effect Schema boundary.
Platform adapters that expose imperative sandbox worker APIs should keep that
facade thin and route every operation through `SandboxCapabilityBridgeService`
before invoking host-specific storage, egress, auth, event, commerce action, or
response logic. Sandbox runner adapters should add their own host-side
invocation timeout because bridge operation deadlines do not protect defects or
non-returning code outside a bridge call.

## Tests

Place new tests in a nested `__tests__/` folder. Every runtime-neutral service
must demonstrate that production and test Layers can run the same business
program without global mutation or platform bindings. Scoped resources must
test acquisition, use, release, and failure/interruption cleanup where
applicable.
