## ADDED Requirements

### Requirement: Store module foundation
The system SHALL provide a `store` commerce module that implements the accepted `store-module-map` ownership boundary for store defaults and administrative settings.

#### Scenario: Store defaults are consumed
- **WHEN** another module needs store-level defaults
- **THEN** it MUST consume the store service contract rather than duplicating store configuration
- **AND** the store module MUST remain free of Cloudflare, Hono, frontend, and concrete database adapter imports
