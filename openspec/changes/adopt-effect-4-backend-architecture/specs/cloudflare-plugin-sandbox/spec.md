## MODIFIED Requirements

### Requirement: Sandboxed plugin manifest contract
Sandboxed plugin manifests and all bridge messages SHALL use Effect Schema and runtime-neutral capability identifiers.

#### Scenario: Plugin bundle is activated
- **WHEN** the host loads a sandboxed plugin
- **THEN** its manifest and requested capabilities MUST decode successfully before execution

### Requirement: Capability-enforcing bridge
The sandbox bridge SHALL expose only granted schema-validated operations and SHALL NOT expose the host Effect runtime, SQL client, secrets, raw bindings, or implementation services.

#### Scenario: Plugin invokes a bridge operation
- **WHEN** the operation is undeclared, unauthorized, malformed, over quota, or past its deadline
- **THEN** the host Effect bridge service MUST reject it with a typed audited failure

### Requirement: Sandboxed plugin observability
Sandbox execution and host bridge operations SHALL produce correlated Effect logs, spans, metrics, typed failures, and security audit events with protected data redacted.

#### Scenario: Sandbox call fails
- **WHEN** a plugin call times out, defects, or returns an invalid response
- **THEN** the host MUST classify and record the outcome without exposing sensitive host state to the plugin

