## ADDED Requirements

### Requirement: Product module expansion
The product module SHALL expand catalog ownership according to `product-module-map` while excluding commercial and transactional state.

#### Scenario: Cart validates a product variant
- **WHEN** downstream cart logic needs catalog identity or variant state
- **THEN** it MUST use the product service contract or workflow input
- **AND** product MUST NOT own prices, inventory quantities, cart lines, payment state, fulfillment state, or order state
