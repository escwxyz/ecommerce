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
