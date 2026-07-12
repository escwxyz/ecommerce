## MODIFIED Requirements

### Requirement: Native plugin registration contract
Trusted native plugins SHALL register through Effect Schema manifests and contribute typed Effect Layers without relying on global mutation.

#### Scenario: Native plugin is activated
- **WHEN** runtime composition loads a trusted plugin
- **THEN** its manifest and declared requirements MUST be validated before its Layers are composed

### Requirement: Native plugin contribution surfaces
Native plugins SHALL be able to contribute module services, providers, API groups, workflows, event handlers, telemetry, and admin metadata through typed Effect contracts.

#### Scenario: Plugin contributes an endpoint
- **WHEN** a native plugin adds API behavior
- **THEN** it MUST contribute an Effect API group and handler Layer with declared schemas and errors

### Requirement: Native plugin boundary safety
Native plugin contracts SHALL remain platform-neutral and SHALL declare capabilities and dependencies explicitly through Effect requirements.

#### Scenario: Plugin requires Cloudflare resource
- **WHEN** a plugin implementation needs a Cloudflare capability
- **THEN** it MUST depend on a portable service contract supplied by the Cloudflare runtime rather than import a binding into core contracts

