## ADDED Requirements

### Requirement: Promotion module foundation
The system SHALL provide a `promotion` commerce module that implements `promotion-module-map` and returns traceable discount adjustment outputs.

#### Scenario: Cart applies a discount
- **WHEN** cart logic applies a discount code or automatic promotion
- **THEN** it MUST call the promotion service contract
- **AND** promotion MUST NOT own base prices, tax amounts, or order financial records
