## MODIFIED Requirements

### Requirement: Schema-backed route procedures
Every backend route SHALL be declared through Effect `HttpApi` with Effect Schema inputs, successes, and typed serialized errors.

#### Scenario: Request reaches an endpoint
- **WHEN** path, query, header, or body data does not satisfy its schema
- **THEN** Effect HTTP MUST reject the request before domain logic runs

### Requirement: Validation-aware route fragment contributions
Module and trusted plugin route contributions SHALL provide composable Effect API groups whose schemas are preserved during assembly.

#### Scenario: Route group is assembled
- **WHEN** the application composes module or plugin endpoints
- **THEN** the resulting API MUST retain each endpoint's declared validation and error contract

### Requirement: Response contracts stay explicit
Every successful and expected failure response SHALL have a declared Effect Schema and deterministic HTTP mapping.

#### Scenario: Handler returns a typed module error
- **WHEN** an endpoint fails with a declared error
- **THEN** middleware MUST serialize it using its declared schema and status mapping

