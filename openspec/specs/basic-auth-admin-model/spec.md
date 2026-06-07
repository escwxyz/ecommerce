# Basic Auth Admin Model

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Basic store actor model

The auth layer SHALL define a baseline actor model where Better Auth admin-capable users represent store administrators and ordinary users represent customers.

#### Scenario: Admin session is resolved

- **WHEN** a request session belongs to a Better Auth admin-capable user
- **THEN** shared auth helpers MUST classify the actor as a store administrator

#### Scenario: Customer session is resolved

- **WHEN** a request session belongs to an authenticated non-admin user
- **THEN** shared auth helpers MUST classify the actor as a customer

### Requirement: Better Auth admin plugin integration

The shared auth package SHALL configure Better Auth with the admin plugin as the first privileged administration primitive.

#### Scenario: Auth factory is reviewed

- **WHEN** maintainers inspect auth configuration
- **THEN** the Better Auth admin plugin MUST be configured in the shared auth package rather than inside product modules or server route handlers

### Requirement: Shared module authorization helpers

Commerce modules SHALL consume shared auth/session helper contracts for permission checks instead of relying on product-local ad hoc session shapes.

#### Scenario: Product route checks permissions

- **WHEN** the product module authorizes a protected product operation
- **THEN** it MUST use shared auth helpers or shared permission descriptors instead of directly assuming a test-only session permission array
