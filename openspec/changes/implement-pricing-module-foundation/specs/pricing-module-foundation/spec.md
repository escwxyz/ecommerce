## ADDED Requirements

### Requirement: Pricing module foundation
The system SHALL provide a `pricing` commerce module that implements `pricing-module-map` and returns traceable calculated price outputs through a service contract.

#### Scenario: Cart requests a line price
- **WHEN** cart logic needs a line-item price
- **THEN** it MUST request pricing through the pricing service contract
- **AND** promotion discounts and tax outputs MUST remain separate from pricing-owned results
