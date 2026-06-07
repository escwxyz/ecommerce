## ADDED Requirements

### Requirement: Effect-native stack lifecycle

The infrastructure entrypoint SHALL define the ecommerce Cloudflare deployment as an Alchemy v2 Effect stack whose lifecycle code returns Effects and composes required services with Layers.

#### Scenario: Stack entrypoint is executed

- **WHEN** the infra package runs the Alchemy entrypoint
- **THEN** the stack lifecycle is represented as an Effect program rather than ad hoc top-level async resource creation.

#### Scenario: Infrastructure services are composed

- **WHEN** the stack needs providers, resources, bindings, or outputs
- **THEN** the implementation composes those concerns through Effect Layers or focused Effect helpers with typed requirements.

### Requirement: Cloudflare resources are stack-owned

The stack SHALL provision and own the Cloudflare resources needed for the bootstrap platform: the API Worker, the TanStack Start admin deployment, and the D1 database.

#### Scenario: Stack deploys bootstrap resources

- **WHEN** `alchemy deploy` is run for a stage
- **THEN** the stage contains a bound API Worker, admin app, and D1 database managed by the stack.

#### Scenario: Stack is destroyed

- **WHEN** `alchemy destroy` is run for a stage
- **THEN** the resources created by that stage are removed or retained only according to explicit resource retention settings.

### Requirement: Bindings are declared in infrastructure

The stack SHALL declare runtime bindings for D1, Better Auth secret, Better Auth URL, CORS origin, server URL, and any frontend-visible API URL in Alchemy infrastructure code.

#### Scenario: API Worker starts

- **WHEN** the API Worker handles a request
- **THEN** database, auth, and CORS values are available through Cloudflare bindings with TypeScript-compatible names.

#### Scenario: Admin app builds

- **WHEN** the TanStack Start admin app is built or deployed
- **THEN** its server URL and required runtime values come from the stack binding contract.

### Requirement: Stack outputs are available for tests and operators

The stack SHALL expose stable outputs for the deployed API URL, admin URL, and database identifier or binding metadata needed by tests and deployment reporting.

#### Scenario: Deployment completes

- **WHEN** `alchemy deploy` completes successfully
- **THEN** the command output or exported stack outputs include the API URL and admin URL.

#### Scenario: Integration tests deploy the stack

- **WHEN** an integration test deploys an isolated stage
- **THEN** the test can read stack outputs without reconstructing resource names manually.
