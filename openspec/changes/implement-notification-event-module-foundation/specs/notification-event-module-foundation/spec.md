## ADDED Requirements

### Requirement: Notification and event module foundation
The system SHALL provide separable event distribution and notification dispatch contracts that implement `notification-event-module-map`.

#### Scenario: Event bus exists before notification providers
- **WHEN** event distribution exists without configured notification providers
- **THEN** modules MUST still be able to publish and observe domain events through the event contract
- **AND** order or other modules MUST NOT call notification provider SDKs directly
