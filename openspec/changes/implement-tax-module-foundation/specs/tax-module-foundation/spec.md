## ADDED Requirements

### Requirement: Tax module foundation
The system SHALL provide a `tax` commerce module that implements `tax-module-map` and returns tax line outputs through a service/provider contract.

#### Scenario: Cart calculates tax
- **WHEN** cart totals need tax for address, region, items, and adjustments
- **THEN** cart MUST call the tax service contract or tax workflow with declared inputs
- **AND** tax MUST NOT own region, currency, market, or sales-channel availability records
