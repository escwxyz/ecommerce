## ADDED Requirements

### Requirement: Inventory module foundation
The system SHALL provide an `inventory` commerce module that implements `inventory-module-map` and uses shared coordination for high-contention reservation mutations.

#### Scenario: Duplicate reservation request arrives
- **WHEN** the same reservation request is delivered more than once with the same idempotency key
- **THEN** inventory MUST resolve it to one logical reservation result
- **AND** it MUST NOT decrement available stock twice
