## ADDED Requirements

### Requirement: Customer module foundation
The system SHALL provide a `customer` commerce module that implements `customer-module-map` and integrates with authentication through shared auth contracts.

#### Scenario: Authenticated actor accesses customer data
- **WHEN** a request resolves customer data from an authenticated session
- **THEN** customer MUST use shared auth/session/permission contracts
- **AND** it MUST NOT import server Worker auth construction code
