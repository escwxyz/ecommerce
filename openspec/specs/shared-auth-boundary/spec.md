# Shared Auth Boundary

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Shared auth contracts

The platform SHALL expose reusable auth/session/user/permission contracts from `packages/auth` so downstream packages can depend on a single source of truth for authenticated identity and authorization vocabulary.

#### Scenario: API or module needs auth types

- **WHEN** API composition, a commerce module, or a future plugin policy needs current-user, session, or permission typing
- **THEN** it MUST import those contracts from `packages/auth` rather than defining local auth types

### Requirement: Server-owned auth provisioning

The server Worker SHALL own runtime auth provisioning, including environment reads, database binding access, auth instance creation, and HTTP handler mounting.

#### Scenario: Better Auth handler is mounted

- **WHEN** the Worker configures auth routes
- **THEN** it MUST create or receive the auth instance in the server composition layer and mount the handler there

### Requirement: Auth context injection

The API layer SHALL receive the shared auth instance or an equivalent auth accessor through context wiring rather than reconstructing auth inside request handling code.

#### Scenario: Request context is built

- **WHEN** `packages/api` creates request context for an incoming request
- **THEN** it MUST use the injected auth instance to resolve session state instead of calling a local auth factory

### Requirement: First permission model uses resource action keys

The shared auth boundary SHALL define the initial permission model as stable resource/action permission keys suitable for module, admin, and plugin authorization checks.

#### Scenario: A module declares an authorization rule

- **WHEN** a module or admin surface needs to name a permission
- **THEN** it MUST be able to express that permission as a stable resource/action key such as `product:read` or `order:create`

### Requirement: Shared auth boundary is verified

The repository SHALL include targeted verification that proves the shared auth package remains the source of truth and that server/API packages do not leak runtime auth construction back into shared code.

#### Scenario: Boundary regression is introduced

- **WHEN** a follow-up change reintroduces local auth construction into `packages/api` or moves runtime provisioning back into shared auth code
- **THEN** tests or boundary checks MUST fail before the change is accepted
