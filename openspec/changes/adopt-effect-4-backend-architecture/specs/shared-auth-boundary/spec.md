## MODIFIED Requirements

### Requirement: Shared auth contracts
Shared auth packages SHALL expose Effect-native identity, session, permission, service, and tagged error contracts without leaking Better Auth types.

#### Scenario: Module requires current identity
- **WHEN** module logic evaluates authorization
- **THEN** it MUST depend only on the shared Effect auth contracts

### Requirement: Server-owned auth provisioning
The Cloudflare runtime SHALL provision the auth service through an adapter Layer, with Better Auth retained only as a temporary private implementation.

#### Scenario: Better Auth handles an operation
- **WHEN** the temporary adapter invokes Better Auth
- **THEN** it MUST translate inputs, outputs, and failures to the shared Effect auth contract

### Requirement: Auth context injection
Effect HTTP middleware SHALL decode authentication state and provide typed identity and permission context to protected handlers.

#### Scenario: Protected endpoint is invoked
- **WHEN** a request lacks the required authenticated identity or permission
- **THEN** the endpoint MUST fail with its declared auth error without invoking business logic

### Requirement: Auth organizations remain provider-neutral
Auth organization, membership, team, and active-organization context SHALL be exposed to commerce code only through provider-neutral Effect auth contracts.

#### Scenario: Module needs tenant or organization context
- **WHEN** module logic needs the active organization, organization membership, team, or tenant-like identity context
- **THEN** it MUST use the Effect auth boundary rather than importing Better Auth organization plugin schemas, tables, migrations, client types, or server API types

#### Scenario: Better Auth organization plugin is enabled
- **WHEN** the Better Auth organization plugin stores organizations, members, invitations, teams, active organization, active team, or organization roles
- **THEN** those records MUST remain auth-provider-owned and MUST NOT become commerce module persistence contracts
