## ADDED Requirements

### Requirement: Shared route fragment contract

The API package SHALL define a shared route fragment contract that allows built-in surfaces, modules, and plugins to contribute oRPC procedures through `packages/api` without importing server transport code.

#### Scenario: Built-in route fragment is registered

- **WHEN** a built-in API surface such as the current health check or authenticated example routes is declared
- **THEN** it MUST be represented as a route fragment consumed by the shared API assembly entry point

### Requirement: Deterministic route assembly

The API package SHALL assemble contributed route fragments in a deterministic way and MUST fail before request handling when two contributors declare the same root procedure key or mount alias.

#### Scenario: Duplicate route key is contributed

- **WHEN** two route fragments register the same root procedure key
- **THEN** API assembly MUST fail with an error that identifies the conflicting contributors and key

### Requirement: Server transport stays composition-only

The server app SHALL mount RPC and OpenAPI handlers from the assembled API surface while continuing to own Hono transport setup, auth handler mounting, CORS, and request-context wiring.

#### Scenario: Server starts with assembled API surface

- **WHEN** `apps/server` creates the Worker app
- **THEN** it MUST consume the root API assembly from `packages/api` and MUST NOT define business procedures inline in the server package

### Requirement: Shared root router typing

The API package SHALL export the root router and derived client typing from the assembled API surface so downstream packages can share one typed contract.

#### Scenario: Admin client consumes API typing

- **WHEN** a downstream package needs request or response typing for an API procedure
- **THEN** it MUST be able to import the shared root router or client type from `packages/api` instead of reconstructing procedure types from fragment internals

### Requirement: Auth-aware procedure composition

The API assembly surface SHALL preserve shared auth-aware procedure helpers and request-context typing for protected and public procedures across all registered fragments.

#### Scenario: Protected fragment procedure is invoked without a session

- **WHEN** a protected procedure contributed through a registered route fragment runs without an authenticated session
- **THEN** it MUST reject the request through the shared auth-aware API boundary rather than using fragment-local auth logic
