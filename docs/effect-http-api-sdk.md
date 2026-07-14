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

Task 4.5 adds the native Alchemy v2 and Effect HTTP Worker foundation in
`apps/server/src/effect-http-worker.ts`. Alchemy owns the Worker lifecycle and
accepts the `HttpEffect` produced by `HttpRouter.toHttpEffect`; request work is
therefore executed by the Worker runtime rather than during Alchemy's init
phase.

`createEffectHttpWorkerApplicationLayer` assembles the admin and storefront
contracts independently, merges their `HttpApiBuilder.group` handler Layers,
provides isolate-scoped runtime Layers once, and registers both APIs on one
Effect router. Missing handler Layers fail while the router Layer is built, so
an incomplete contract cannot silently deploy as a partial API.

The runtime deliberately provides a file-response stub. Canonical commerce
HTTP endpoints are JSON or stream based; Cloudflare asset/file support must be
introduced later through an explicit platform adapter rather than importing a
Node filesystem into the Worker.

The existing Hono Worker remains the deployed entrypoint during vertical
migration. The Effect Worker is the canonical replacement foundation, but its
contribution list stays empty until migrated module groups are ready. This keeps
legacy behavior available without creating a second reusable handler or schema
ownership boundary in `apps/server`.

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
The server-only Cloudflare Service Binding transport is intentionally deferred
to task 4.8 and must live behind a separate export so browser bundles can ban it
explicitly in task 4.10.
