# Region Sales-Channel Module Foundation

## Purpose

Synced from completed OpenSpec changes. This spec captures the current accepted requirements for this capability.

## Requirements

### Requirement: Region and sales-channel module foundation

The system SHALL provide initial region and sales-channel module contracts that implement `region-sales-channel-module-map` while preserving distinct responsibility surfaces.

#### Scenario: Initial package combines capabilities

- **WHEN** region and sales-channel are implemented in one package
- **THEN** the package MUST expose distinct module keys or service surfaces for region constraints and sales-channel publishability
