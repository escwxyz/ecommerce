## ADDED Requirements

### Requirement: Order module foundation
The system SHALL provide an `order` commerce module that implements `order-module-map` and owns post-checkout order records.

#### Scenario: Order is created from checkout
- **WHEN** checkout workflow outputs satisfy cart, inventory, payment, fulfillment, tax, promotion, and validation requirements
- **THEN** order MUST create records through its service contract with immutable snapshots
- **AND** it MUST NOT read private repositories from participating modules
