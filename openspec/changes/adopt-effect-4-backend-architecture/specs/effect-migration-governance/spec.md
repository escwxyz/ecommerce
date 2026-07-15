## ADDED Requirements

### Requirement: Verified vertical-slice migration
The backend SHALL migrate through buildable vertical slices, beginning with shared foundations and the store tracer module.

#### Scenario: Slice is declared complete
- **WHEN** a module slice has migrated
- **THEN** its Effect implementation MUST pass domain, schema, repository, HTTP, workflow, boundary, and applicable Cloudflare tests before its legacy path is removed

### Requirement: Legacy deletion gate
A migrated slice SHALL NOT retain Hono, oRPC, Zod, or Kysely backend implementations or dependencies.

#### Scenario: New slice replaces legacy code
- **WHEN** the Effect implementation meets its test gate
- **THEN** the corresponding legacy route, schema, repository, migration, and dependency declarations MUST be deleted

### Requirement: Temporary bridge accountability
Every temporary migration bridge SHALL have an owner, removal task, and explicit deletion criterion and SHALL NOT be used by newly migrated code.

#### Scenario: Compatibility seam is introduced
- **WHEN** a slice temporarily interoperates with unmigrated code
- **THEN** the active change MUST identify when and how that seam will be removed

### Requirement: Store tracer preserves marketplace extensibility
The store tracer module SHALL remain a commerce settings/defaults module and SHALL NOT encode a fixed tenancy model that prevents normal store, multi-store, merchant, vendor, market, or marketplace extensions.

#### Scenario: Store ownership is modeled
- **WHEN** the store module needs to represent ownership or tenant-like context
- **THEN** it MUST use provider-neutral commerce or auth identifiers and MUST NOT treat a Better Auth organization as the store record itself

#### Scenario: Marketplace behavior is added later
- **WHEN** marketplace behavior links vendors, merchants, products, orders, stores, workflows, settlement policies, or vendor/admin surfaces
- **THEN** it SHOULD be implemented through commerce modules or plugins that link domain records explicitly rather than overloading the store module as the marketplace aggregate
