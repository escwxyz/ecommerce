# Module Auth Permission Composition

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Module permission descriptor declarations

Commerce modules SHALL declare owned permission descriptors through module contribution contracts rather than requiring `packages/auth` to hardcode module-specific permission vocabulary.

#### Scenario: Product module declares permissions

- **WHEN** the product module is composed
- **THEN** its `product:read` and `product:write` permissions MUST be available from product-owned permission descriptors

#### Scenario: Auth package is inspected

- **WHEN** maintainers inspect `packages/auth`
- **THEN** it MUST NOT import product module packages or hardcode product-specific commerce permission vocabulary

### Requirement: Permission descriptor composition

The platform SHALL collect permission descriptors from installed modules and supported plugin contributions into a composed permission statement before Better Auth adapter construction.

#### Scenario: Module permissions are collected

- **WHEN** API/server composition installs the product module
- **THEN** the composed permission statement MUST include the product module's declared permission resources and actions

#### Scenario: Duplicate permission is declared

- **WHEN** two modules or plugins declare the same permission ownership without an accepted override contract
- **THEN** composition MUST fail before runtime request handling and identify the conflicting permission

### Requirement: Auth adapter receives composed statement

The auth package SHALL receive a composed commerce permission statement and use it to construct Better Auth custom access control and roles without depending on module packages.

#### Scenario: Better Auth admin plugin is configured

- **WHEN** the auth factory configures the Better Auth admin plugin
- **THEN** it MUST use an access controller built from Better Auth default statements plus the composed module/plugin permission statement

#### Scenario: Customer role is built

- **WHEN** the default customer/user role is created
- **THEN** it MUST NOT receive Better Auth default admin `user` or `session` permissions unless a later accepted change explicitly grants them

#### Scenario: Store admin role is built

- **WHEN** the store administrator role is created
- **THEN** it MUST include Better Auth default admin statements plus composed commerce permissions

### Requirement: Module route and admin metadata reuse

Module route authorization and admin metadata SHALL reuse module-owned permission descriptors instead of constructing matching strings independently.

#### Scenario: Product route checks write permission

- **WHEN** the product route authorizes product creation
- **THEN** it MUST reference the product module's declared write permission descriptor or key

#### Scenario: Product admin metadata declares navigation permission

- **WHEN** product admin metadata declares the Products navigation surface
- **THEN** it MUST reference the product module's declared read permission descriptor or key

### Requirement: Plugin and sandbox permission validation

Native plugin permissions and sandboxed plugin permission requirements SHALL be validated against the composed permission statement before participating in runtime composition.

#### Scenario: Plugin declares unsupported permission

- **WHEN** a plugin admin surface or bridge action declares a permission absent from the composed permission statement
- **THEN** host composition MUST reject that contribution before exposing the surface or action

#### Scenario: Sandboxed plugin uses host action

- **WHEN** a sandboxed plugin requests a host action with a declared permission requirement
- **THEN** bridge policy MUST evaluate the actor against the composed permission vocabulary and shared auth evaluator

### Requirement: Superseded auth-admin planning review

The implementation SHALL review `add-basic-auth-admin-model` and resolve any tasks that are superseded by current auth plugin and permission evaluator implementation.

#### Scenario: Superseded task is found

- **WHEN** an `add-basic-auth-admin-model` task is already implemented by `centralize-auth-permission-evaluation` or this change
- **THEN** the task MUST be marked complete or documented as superseded with the implementation that satisfies it

#### Scenario: D1 schema work remains

- **WHEN** Better Auth admin plugin schema or migration artifacts remain incomplete
- **THEN** the remaining work MUST be retained as a narrow task or follow-up change rather than hidden under superseded auth model tasks
