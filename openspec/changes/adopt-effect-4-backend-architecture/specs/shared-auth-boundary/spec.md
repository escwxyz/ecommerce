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

