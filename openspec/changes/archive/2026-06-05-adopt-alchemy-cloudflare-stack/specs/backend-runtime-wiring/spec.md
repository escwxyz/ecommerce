## ADDED Requirements

### Requirement: Hono Worker serves platform routes

The backend runtime SHALL serve the ecommerce API through Hono on Cloudflare Workers while preserving the existing route surfaces.

#### Scenario: Health check request

- **WHEN** a client requests `GET /`
- **THEN** the Worker returns a successful plain text health response.

#### Scenario: Auth route request

- **WHEN** a client requests `/api/auth/*` with a supported Better Auth method
- **THEN** Hono forwards the request to the Better Auth handler.

#### Scenario: RPC route request

- **WHEN** a client sends an oRPC request under `/rpc`
- **THEN** the Worker handles it through the shared `appRouter` and request context.

#### Scenario: OpenAPI reference request

- **WHEN** a client requests the API reference under `/api-reference`
- **THEN** the Worker serves the oRPC OpenAPI reference using the configured schema converter.

### Requirement: Runtime environment uses typed Cloudflare bindings

Backend runtime code SHALL access deployment configuration and resources through the typed environment boundary rather than direct Worker-global assumptions or scattered process environment reads.

#### Scenario: Database client is created

- **WHEN** backend code creates a Drizzle client
- **THEN** it uses the D1 binding exposed by `@ecommerce/env/server`.

#### Scenario: Auth service is created

- **WHEN** backend code creates Better Auth configuration
- **THEN** it reads auth secret, base URL, trusted origin, and database binding through the typed environment boundary.

### Requirement: API context carries authenticated session state

The oRPC context SHALL include authenticated session state when a request has a valid Better Auth session and SHALL reject protected procedures otherwise.

#### Scenario: Protected procedure without session

- **WHEN** an unauthenticated request calls a protected procedure
- **THEN** the API returns an unauthorized oRPC error.

#### Scenario: Protected procedure with session

- **WHEN** an authenticated request calls a protected procedure
- **THEN** the procedure receives the session and can access the user information.

### Requirement: Effect stays out of frontend UI code

The implementation SHALL limit Effect usage to backend logic, infrastructure code, tests, and supporting runtime wiring; frontend React routes and UI components MUST NOT import Effect modules.

#### Scenario: Frontend route code is inspected

- **WHEN** frontend files under `apps/web/src` are checked
- **THEN** they do not import `effect`, `alchemy`, or infrastructure-only modules.

#### Scenario: Backend logic needs effectful composition

- **WHEN** backend business logic or infrastructure lifecycle code needs typed dependency composition
- **THEN** it may return Effects and use Layers.
