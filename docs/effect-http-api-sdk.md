# Effect HTTP API and SDK Foundation

## Canonical API roots

Task 4.1 introduces the canonical Effect HTTP API roots in `@ecommerce/api`:

- `adminHttpApi`
- `storefrontHttpApi`

The admin root owns backend contracts for admin/dashboard operations. The
storefront root owns public customer-facing contracts and is the future source
for both browser HTTP and Cloudflare Service Binding SDK transports.

## Contribution rule

Modules and trusted plugins contribute `HttpApiGroup` contracts through
`EffectHttpApiGroupContribution` values. Each contribution must carry both the
group contract and its handler `Layer`; later assembly tasks compose those
groups into the canonical roots and serve them from the Cloudflare Worker.

The API contract package owns these roots. Server packages provide runtime
Layers and transport only; they do not own reusable API schemas or commerce
handlers.

## Shared transport schemas

Task 4.2 adds shared API-boundary schemas in `@ecommerce/api`:

- `ApiPaginationRequest`, `ApiPaginationMeta`, `ApiPageLimit`, and
  `ApiPageOffset` define the common offset pagination contract.
- `ApiRequestIdentity` carries serialized `requestId`, `correlationId`, and
  optional trace/session/actor identifiers. Auth-specific identity/session
  contracts are added later by the auth boundary tasks.
- `createApiSuccessSchema(dataSchema)` wraps endpoint payload schemas in a
  standard `{ success: true, data, meta }` envelope.
- `createApiPaginatedSuccessSchema(itemSchema)` wraps list item schemas with
  shared pagination metadata.
- `SerializedApiError`, `ApiErrorDetails`, and `ApiErrorDetailValue` define the
  sanitized transport error envelope used by HTTP and SDK transports.

Shared API schemas must remain JSON-serializable. Error details are limited to
bounded scalar values (`string`, JSON number, `boolean`, or `null`) so raw
Causes, SQL messages, stack traces, provider payloads, credentials, and other
internal data cannot leak through generic error serialization.

Endpoint-specific modules still own their domain and API payload schemas. The
shared schemas only define transport envelope, pagination, request identity, and
sanitized error conventions that every admin/storefront `HttpApi` group can
reuse.

## Shared middleware foundation

Task 4.3 adds the request middleware foundation in `@ecommerce/api`:

- `CurrentEffectHttpRequestContext` carries request identity, method, path,
  start time, and deadline as a request-scoped Effect service.
- `EffectHttpRequestIdGenerator` is the deterministic ID-generation seam used
  when incoming headers do not provide `x-request-id`.
- `EffectHttpAuthService` and `EffectHttpPermissionService` are adapter seams
  for authentication and authorization. They intentionally depend on existing
  auth/session types only; task 5 defines the permanent auth schemas and Better
  Auth adapter.
- `withEffectHttpRequestContext`, `withEffectHttpAuth`,
  `withEffectHttpPermission`, `withEffectHttpDeadline`, and
  `withEffectHttpTelemetry` are composable wrappers for endpoint handler
  Effects.
- `EffectHttpRequestContextMiddleware`, `EffectHttpAuthMiddleware`, and
  `EffectHttpExecutionMiddleware` are `HttpApiMiddleware.Service` contracts
  with corresponding Layers for Effect HTTP assembly.
- `serializeEffectHttpMiddlewareFailure` and
  `serializeSanitizedEffectHttpCause` convert expected middleware failures,
  defects, and interruptions into the shared sanitized error envelope.

Request middleware must provide fresh per-request services. It must not store
identity, auth state, permissions, deadlines, or trace data in module singletons
or mutable globals. Defect serialization stays deliberately generic; full
Effect Causes remain internal telemetry data and are not exposed through HTTP or
SDK errors.

## Deterministic API assembly

Task 4.4 adds deterministic Effect `HttpApi` assembly in `@ecommerce/api`:

- `createEffectHttpApiAssembly` selects contributions for one surface
  (`admin` or `storefront`), sorts them by surface, owner, key, and group
  identifier, and adds the groups to the provided canonical root.
- The assembly output exposes the assembled `api`, selected `contributions`,
  ordered `groups`, handler `Layer`s, and route fingerprints used by later
  OpenAPI, SDK, and Worker composition tasks.
- Every endpoint contributes a route fingerprint with `method`, `path`,
  `routeKey`, group identifier, endpoint name, owner, surface, and contribution
  key.
- Duplicate method/path pairs fail with `EffectHttpApiAssemblyError` before
  deployment. Admin and storefront surfaces are checked independently.
- Duplicate group identifiers also fail because Effect `HttpApi.add` would
  otherwise overwrite the earlier group with the later one.

Module and plugin registration order must not affect the assembled contract.
If two packages need the same path, they must use different HTTP methods or
resolve the route ownership before Worker/OpenAPI generation.

## Cloudflare Worker runtime composition

The deployed Worker entrypoint is `apps/server/src/index.ts`. It builds the
Effect HTTP runtime with the explicit composition from
`apps/server/src/production-commerce-runtime.ts`; Alchemy owns deployment while
request work executes inside the Worker runtime.

`createEffectHttpWorkerApplicationLayer` assembles the admin and storefront
contracts independently, merges their `HttpApiBuilder.group` handler Layers,
provides isolate-scoped runtime Layers once, and registers both APIs on one
Effect router. Missing handler Layers fail while the router Layer is built, so
an incomplete contract cannot silently deploy as a partial API.

The runtime deliberately provides a file-response stub. Canonical commerce
HTTP endpoints are JSON or stream based; Cloudflare asset/file support must be
introduced later through an explicit platform adapter rather than importing a
Node filesystem into the Worker.

Production startup requires the Hyperdrive, cart-cache Durable Object,
stateful-coordinator Durable Object, notification queue, and notification
realtime bindings. Missing production bindings raise a typed configuration
error. The Worker supplies PostgreSQL repository Layers and Cloudflare platform
Layers once; module constructors do not select persistence, actor, provider, or
checkout-completion adapters. Development tests opt into the separate
`commerce-runtime.ts` compatibility seam and receive fresh in-memory state.

## Derived OpenAPI snapshots

Task 4.6 adds `createEffectHttpApiOpenApiSnapshot` in `@ecommerce/api`. The
helper accepts the same module and plugin group contributions used by Worker
composition, builds deterministic admin and storefront assemblies, and derives
OpenAPI 3.1 documents through Effect's `OpenApi.fromApi`.

Snapshots are serialized with stable object key ordering so contract changes
produce reviewable diffs. The checked snapshots live beside the API tests under
`packages/api/src/__tests__/__snapshots__/`; they are generated artifacts of the
canonical Effect `HttpApi` contract, not a parallel API definition.

Future SDK generation tasks should consume this derived document or the
underlying `HttpApi` assembly. They must not introduce separate OpenAPI schemas
that can drift from Effect Schema declarations.

## Storefront public HTTP SDK transport

Task 4.7 adds `@ecommerce/storefront-sdk` as the dedicated storefront client
package. Browser and generic fullstack server consumers import
`@ecommerce/storefront-sdk/http` or the package root to create an Effect
`HttpApiClient` from the canonical storefront contract.

- `createStorefrontHttpClient(options)` targets the canonical
  `storefrontHttpApi` exported by `@ecommerce/api`.
- `createStorefrontHttpClientForApi({ api, ...options })` accepts an
  explicit assembled storefront `HttpApi` contract, preserving generated group
  and endpoint method types for module-extended tests and future SDK assembly.
- The transport uses `FetchHttpClient.layer` from `effect/unstable/http`, so it
  depends only on public `fetch`, `baseUrl`, and optional `RequestInit`.
- Tests can inject a custom `fetch` implementation without mutating
  `globalThis.fetch`.
- `@ecommerce/storefront-sdk/browser` remains a browser-safe compatibility
  alias for the same public HTTP transport, while new shared fullstack code
  should prefer the `http` export.

The public HTTP export must not import Cloudflare bindings, server Worker runtime
composition, domain services, repository Layers, SQL clients, or credentials.

## Storefront Cloudflare Service Binding SDK transport

Task 4.8 adds `@ecommerce/storefront-sdk/cloudflare` as the server-only
Cloudflare transport for Worker and SSR code that receives a backend Worker
Service Binding.

- `createStorefrontServiceBindingClient(options)` targets the canonical
  `storefrontHttpApi` exported by `@ecommerce/api`.
- `createStorefrontServiceBindingClientForApi({ api, ...options })` accepts an
  explicit assembled storefront `HttpApi` contract and preserves the same
  generated group and endpoint method types as the public HTTP transport.
- `StorefrontServiceBinding` is a minimal structural interface for a binding
  with a `fetch` method. The SDK does not import Cloudflare runtime bindings in
  its package root.
- The transport adapts the binding `fetch` to Effect's `FetchHttpClient.layer`
  and uses `https://storefront.service-binding` as the default internal base
  URL for path construction.

The Service Binding transport must remain behind the `cloudflare` export and
must not be re-exported from the package root.

## Storefront SDK transport conformance

Task 4.9 adds a shared conformance suite in
`packages/storefront-sdk/src/__tests__/transport-conformance-suite.ts`.
Transport-specific tests register the public HTTP and Cloudflare Service Binding
client factories against one test `HttpApi` contract and assert that both:

- return the same decoded Effect Schema response shape;
- preserve the same generated `HttpApiClient` group and endpoint method
  surface;
- issue the same HTTP method and relative storefront route;
- differ only by transport origin: public `baseUrl` versus the internal
  Service Binding base URL.

Future storefront SDK transports must join this shared suite before they are
accepted as equivalent to the canonical SDK contract.

## Storefront SDK browser-bundle boundary

Task 4.10 adds executable browser-bundle boundaries for both frontend consumers
and the SDK package itself:

- `apps/web/src/__tests__/no-effect-imports.test.ts` rejects static,
  side-effect, and dynamic imports of `@ecommerce/storefront-sdk/cloudflare`
  from browser source, alongside the existing backend runtime bans.
- `packages/storefront-sdk/src/__tests__/browser-bundle-boundary.test.ts`
  asserts that the package root, `http`, and `browser` entries do not re-export
  the server-only Cloudflare transport.
- The SDK boundary test also rejects server runtime imports such as
  `cloudflare:workers`, `@cloudflare/workers-types`, and
  `@ecommerce/platform-cloudflare` from browser-safe SDK entries.

The intended import split is therefore:

- browser and generic fullstack code: `@ecommerce/storefront-sdk/http` or the
  package root;
- explicit browser alias: `@ecommerce/storefront-sdk/browser`;
- Cloudflare Worker or SSR code with a backend Service Binding:
  `@ecommerce/storefront-sdk/cloudflare`.

## Store API and SDK migration status

Task 6.7 through 6.10 wire the store tracer slice into the Effect HTTP and SDK
foundation:

- The store admin API group exposes protected store settings read/write
  endpoints through the canonical Effect admin root.
- The store storefront API group exposes public store defaults through the
  canonical Effect storefront root.
- The Cloudflare Effect Worker composition serves the migrated store groups
  through Effect HTTP handlers backed by `StoreService`.
- The storefront SDK store helper is transport-neutral at the contract level and
  is verified against both public HTTP and server-only Cloudflare Service
  Binding clients.

The remaining gap is deployment switchover, not contract ownership. The Hono
entrypoint and oRPC aggregate remain for unmigrated modules until later slices
and section 12 remove the compatibility runtime.
