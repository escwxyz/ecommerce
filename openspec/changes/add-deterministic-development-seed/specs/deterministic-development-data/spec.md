## ADDED Requirements

### Requirement: Local seed workflow is explicit and adapter-owned

The platform SHALL provide an explicit development seed command owned by the D1 adapter package, and the command MUST target local D1 storage without automatically seeding remote or production databases.

#### Scenario: Developer seeds local D1

- **WHEN** a developer runs the repository development seed command after local migrations
- **THEN** the command MUST execute the adapter-owned seed artifact against the configured local `Database` binding

#### Scenario: Development server starts

- **WHEN** the normal development stack starts without the seed command
- **THEN** it MUST NOT automatically overwrite or recreate deterministic seed records

### Requirement: Golden checkout prerequisites are connected

The deterministic dataset SHALL include the minimum connected store, region, sales-channel, catalog, pricing, inventory, tax, customer, and fulfillment records required to begin a golden checkout-path smoke test.

#### Scenario: Seeded product is checkout-ready

- **WHEN** the seed completes successfully
- **THEN** the seeded product and variant MUST be published to the seeded sales channel, priced in the seeded store currency, stocked at the seeded location, and associated with compatible region, tax, and fulfillment configuration

#### Scenario: Seeded customer starts checkout

- **WHEN** the seeded customer is used in a development checkout flow
- **THEN** the dataset MUST provide a stable customer identity and address compatible with the seeded region

### Requirement: Seed execution is deterministic and idempotent

Seed records SHALL use stable reserved identifiers and convergent writes so repeated execution produces the same logical dataset without duplicate entities or relationship rows.

#### Scenario: Seed runs twice

- **WHEN** the development seed command executes twice against the same migrated local database
- **THEN** entity counts, stable identifiers, unique values, and cross-module relationships MUST remain unchanged after the second execution

#### Scenario: Seeded descriptive value changes locally

- **WHEN** a reserved seeded record has a mutable fixture-owned field changed and the seed runs again
- **THEN** the field MAY converge to the declared fixture value while the record identifier and relationship keys MUST remain stable

### Requirement: Seed artifact matches the migrated schema

The generated seed artifact MUST be executable against the complete ordered D1 migration set and SHALL be validated without Cloudflare credentials.

#### Scenario: Seed compatibility test runs

- **WHEN** automated seed verification creates an isolated SQLite database
- **THEN** it MUST apply every D1 SQL migration, execute the same generated seed artifact used by Wrangler, and verify representative checkout relationships

#### Scenario: Schema changes invalidate seed data

- **WHEN** a migration changes a seeded table or required column incompatibly
- **THEN** seed verification MUST fail before the change is considered complete

### Requirement: Transaction history remains outside the prerequisite seed

The initial deterministic dataset MUST NOT fabricate completed carts, orders, payments, fulfillments, notification events, or authentication credentials.

#### Scenario: Prerequisite seed completes

- **WHEN** the initial seed finishes
- **THEN** the database MUST contain checkout prerequisites without pre-created completed transaction history or login credentials
