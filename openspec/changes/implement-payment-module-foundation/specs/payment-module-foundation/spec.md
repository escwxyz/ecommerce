## ADDED Requirements

### Requirement: Payment module foundation
The system SHALL provide a `payment` commerce module that implements `payment-module-map` with normalized ecommerce payment actions and provider webhook mapping.

#### Scenario: Provider webhook is received
- **WHEN** a configured provider receives a webhook payload
- **THEN** the provider adapter MUST return a normalized payment webhook action result
- **AND** PayKit-specific concepts MUST remain translated at the adapter boundary if PayKit is added later
