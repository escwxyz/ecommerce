# Admin Metadata Extensibility

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Admin metadata schema

The platform SHALL define a typed admin metadata schema for module and plugin contributions covering navigation entries, resource screens, forms, tables, dashboard widgets, actions, required permissions, and API operation references.

#### Scenario: Module declares admin metadata

- **WHEN** a module contributes an admin surface
- **THEN** the contribution MUST conform to the shared admin metadata schema before it can participate in admin composition

#### Scenario: Metadata includes API operation references

- **WHEN** an admin resource or action needs backend data
- **THEN** its metadata MUST reference typed API operations instead of backend service implementations or Cloudflare runtime bindings

### Requirement: Admin metadata discovery

The platform SHALL compose module and plugin admin metadata into a normalized discovery model with stable IDs, source identity, ordering, grouping, and duplicate detection.

#### Scenario: Multiple contributors provide navigation

- **WHEN** installed modules and active plugins contribute admin navigation entries
- **THEN** the admin discovery model MUST include their normalized entries with deterministic ordering and source identity

#### Scenario: Duplicate metadata IDs are detected

- **WHEN** two admin metadata contributions resolve to the same global ID
- **THEN** metadata composition MUST fail with the conflicting contributors identified

### Requirement: Permission-aware metadata surfaces

Admin metadata SHALL declare required permissions for navigation entries, resources, widgets, actions, and referenced API operations, and the admin app MUST use those declarations to hide, disable, or reject unauthorized surfaces consistently with backend authorization.

#### Scenario: User lacks navigation permission

- **WHEN** an admin user lacks the permission required by a navigation entry
- **THEN** the admin discovery response or app shell MUST not present that entry as an available surface

#### Scenario: User invokes unauthorized operation

- **WHEN** an admin user invokes an API operation referenced by metadata without the required permission
- **THEN** the backend MUST reject the operation even if the frontend metadata filtering was bypassed

### Requirement: Frontend runtime boundary

The TanStack Start admin app SHALL render metadata-driven surfaces through typed API clients, auth client utilities, and approved UI primitives without importing Effect runtime concepts, Cloudflare bindings, Hono server types, or concrete module internals.

#### Scenario: Admin screen renders module data

- **WHEN** a metadata-driven admin screen renders module data
- **THEN** it MUST fetch and mutate data through the shared typed API client rather than importing backend runtime services

#### Scenario: Boundary check runs

- **WHEN** admin metadata rendering code is checked
- **THEN** the check MUST fail if `apps/web` imports Cloudflare bindings, Effect runtime services, or concrete backend module internals

### Requirement: Host-rendered sandboxed plugin surfaces

Sandboxed plugin admin contributions SHALL be represented as metadata for host-rendered primitives unless a later accepted change defines a safe plugin UI isolation boundary.

#### Scenario: Sandboxed plugin contributes widget

- **WHEN** a sandboxed plugin contributes a dashboard widget
- **THEN** the widget MUST be described with approved host-rendered primitive metadata rather than unrestricted plugin-supplied frontend code

#### Scenario: Sandboxed plugin declares unsupported primitive

- **WHEN** sandboxed plugin metadata references an unsupported primitive or arbitrary component module
- **THEN** metadata validation MUST reject the contribution before it is exposed to the admin app

### Requirement: Admin metadata contract tests

The implementation SHALL include contract tests for metadata validation, contribution discovery, duplicate ID detection, permission filtering, API operation references, and sandboxed plugin primitive restrictions.

#### Scenario: Contract tests validate module and plugin contributions

- **WHEN** representative module and plugin admin metadata fixtures are tested
- **THEN** the tests MUST prove that valid contributions compose successfully and invalid contributions fail with actionable errors

#### Scenario: Permission filtering is tested

- **WHEN** contract tests run against users with different permissions
- **THEN** the tests MUST prove that unavailable surfaces are filtered or rejected consistently with declared permissions
