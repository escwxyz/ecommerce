# Auth Permission Evaluation

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Shared authorization evaluator

The auth package SHALL expose a shared authorization evaluator contract for resolving actors, reading permission keys, and checking required permissions from authenticated request context.

#### Scenario: Module checks a permission

- **WHEN** a commerce module authorizes a protected operation
- **THEN** it MUST call the shared auth evaluator or a helper backed by that evaluator instead of reading permission arrays directly from the raw session object

#### Scenario: Missing authenticated actor

- **WHEN** a protected operation is evaluated without an authenticated user
- **THEN** the evaluator MUST produce an authentication failure distinct from an authenticated actor that lacks a permission

### Requirement: Centralized permission extraction

The system SHALL keep session permission extraction and normalization inside `packages/auth` so API packages, modules, admin metadata, and plugin policy do not duplicate Better Auth session-shape assumptions.

#### Scenario: Session shape changes

- **WHEN** Better Auth admin plugin session or role representation changes
- **THEN** maintainers MUST update the shared auth extraction logic without editing each module, admin metadata composer, or plugin policy call site

#### Scenario: Call site inspects permissions

- **WHEN** route, metadata, or policy code needs the current actor's permissions
- **THEN** it MUST consume normalized permission keys or decisions from the shared auth boundary

### Requirement: Better Auth custom permission adapter

The shared auth package SHALL define the Better Auth custom access-control statement and role configuration that represent the commerce resource/action permission vocabulary.

#### Scenario: Auth factory configures admin plugin

- **WHEN** the Better Auth admin plugin is configured for the server runtime
- **THEN** it MUST receive the commerce access controller and roles from the shared auth package rather than ad hoc role definitions in server routes or commerce modules

#### Scenario: Admin client configures permissions

- **WHEN** the admin client needs Better Auth admin permission helpers
- **THEN** it MUST use the same shared access controller and role definitions as the server-side admin plugin configuration

#### Scenario: Default admin permissions are extended

- **WHEN** custom commerce roles extend Better Auth's default admin capabilities
- **THEN** the configuration MUST preserve required default admin user/session permissions unless a future accepted change explicitly removes them

### Requirement: Actor classification integration

The evaluator SHALL classify authenticated sessions according to the baseline store actor model before applying permission decisions.

#### Scenario: Admin-capable user is evaluated

- **WHEN** a Better Auth admin-capable user performs a protected store administration operation
- **THEN** the evaluator MUST resolve the actor as a store administrator and evaluate the operation against store-administration permissions

#### Scenario: Customer user is evaluated

- **WHEN** an authenticated non-admin user performs a customer-allowed operation
- **THEN** the evaluator MUST resolve the actor as a customer and evaluate the operation against customer permissions

### Requirement: Consistent admin metadata filtering

Admin metadata discovery SHALL use the shared evaluator for permission filtering while preserving backend route enforcement as the security boundary.

#### Scenario: User lacks admin surface permission

- **WHEN** an authenticated actor lacks the permission declared by an admin metadata surface
- **THEN** the admin metadata response MUST omit or mark that surface unavailable using the shared evaluator result

#### Scenario: User calls hidden operation directly

- **WHEN** an actor directly invokes an API operation for a hidden or unavailable admin surface
- **THEN** the backend route MUST independently reject the operation through the shared evaluator

### Requirement: Plugin and sandbox policy reuse

Plugin manifests, native plugin contributions, and sandbox bridge policy SHALL express authorization requirements through the shared permission descriptor and evaluator contracts.

#### Scenario: Sandboxed plugin requests host action

- **WHEN** a sandboxed plugin asks the host bridge to perform an action requiring an actor permission
- **THEN** the bridge policy MUST evaluate the actor through the shared auth evaluator before allowing the action

#### Scenario: Plugin declares unsupported permission

- **WHEN** a plugin contribution declares a permission outside the supported commerce vocabulary
- **THEN** plugin or admin metadata validation MUST reject the contribution before it participates in runtime composition

### Requirement: Authorization test helpers

The auth package SHALL provide test helpers or fixtures that construct representative anonymous, customer, and store-admin authorization contexts without requiring tests to hand-build raw Better Auth session internals.

#### Scenario: Module authorization test

- **WHEN** a module test needs an authorized or forbidden actor
- **THEN** it MUST be able to use shared auth fixtures to create the actor context and assert evaluator behavior
