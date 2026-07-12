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

