## ADDED Requirements

### Requirement: Local development uses Alchemy-managed Cloudflare runtime

The project SHALL provide a local development workflow that runs the Alchemy-managed Cloudflare stack with hot reload for the API Worker and admin app.

#### Scenario: Developer starts local stack

- **WHEN** a developer runs the documented development command
- **THEN** Alchemy starts the API and admin app with Cloudflare-compatible bindings.

#### Scenario: Local URLs are reported

- **WHEN** the local stack starts successfully
- **THEN** the API and admin URLs are visible to the developer.

### Requirement: Integration tests deploy an isolated stack

The project SHALL include integration tests that can deploy an isolated Alchemy stage, exercise deployed endpoints over HTTP, and clean up resources when appropriate.

#### Scenario: Test stack deploys

- **WHEN** integration tests run with Cloudflare credentials available
- **THEN** they deploy an isolated test stage and read its stack outputs.

#### Scenario: Deployed API is verified

- **WHEN** integration tests call the deployed API URL
- **THEN** they verify the health endpoint and at least one oRPC endpoint.

#### Scenario: Test cleanup runs

- **WHEN** integration tests finish in CI or explicit cleanup mode
- **THEN** they destroy the isolated test stage or report the stage name for manual cleanup if teardown fails.

### Requirement: Deploy and destroy commands are repo-level workflows

The project SHALL expose repo-level commands for deploying and destroying the Alchemy stack through the infra package.

#### Scenario: Deploy command is run

- **WHEN** `bun run deploy` is run from the repository root
- **THEN** Turborepo invokes the infra package deployment command.

#### Scenario: Destroy command is run

- **WHEN** `bun run destroy` is run from the repository root
- **THEN** Turborepo invokes the infra package destroy command for the selected stage.

### Requirement: Verification gates cover infra and runtime

The change SHALL define verification commands for type safety, lint/format compliance, app build, and deployment smoke checks.

#### Scenario: Standard verification runs

- **WHEN** implementation is complete
- **THEN** typecheck, Ultracite check, build, and targeted tests pass or documented credential-related gaps are reported.

#### Scenario: Cloud credentials are unavailable

- **WHEN** deployment tests cannot run because Cloudflare credentials are unavailable
- **THEN** the implementation reports the skipped checks and still runs local static/type/build verification.
