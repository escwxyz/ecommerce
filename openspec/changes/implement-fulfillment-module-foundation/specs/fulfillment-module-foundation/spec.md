## ADDED Requirements

### Requirement: Fulfillment module foundation
The system SHALL provide a `fulfillment` commerce module that implements `fulfillment-module-map` with replaceable provider contracts.

#### Scenario: Shipping provider is replaced
- **WHEN** a fulfillment provider changes
- **THEN** cart and order code MUST continue to depend on fulfillment service contracts
- **AND** fulfillment MUST NOT own payment authorization, capture, refund, pricing, promotion, or tax state
