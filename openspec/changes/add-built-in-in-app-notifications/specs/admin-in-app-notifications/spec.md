## ADDED Requirements

### Requirement: Built-in channel creates admin inbox records
The platform SHALL provide a host-owned `in-app` notification provider that converts eligible notification dispatches into persistent inbox records for authenticated administrators without requiring an external provider plugin.

#### Scenario: In-app notification is delivered
- **WHEN** the queue consumer processes an `in-app` dispatch addressed to an administrator
- **THEN** the built-in provider MUST create one inbox record scoped to that administrator
- **AND** the dispatch MUST transition to delivered only after the inbox record is persisted

#### Scenario: In-app delivery is retried
- **WHEN** the queue consumer receives the same in-app dispatch more than once
- **THEN** the provider MUST return the original delivery result without creating a duplicate inbox record

### Requirement: Inbox records are distinct from delivery audit records
The notification-event module SHALL own inbox records separately from notification dispatch and provider audit records, and each inbox record MUST preserve administrator identity, presentation content, lifecycle state, action metadata, and source trace metadata.

#### Scenario: Inbox record is persisted
- **WHEN** an in-app dispatch is delivered
- **THEN** the inbox record MUST preserve its recipient administrator ID, title, body or structured presentation payload, creation time, unread state, optional action target, source dispatch ID, correlation ID, and optional causation or workflow identifiers

#### Scenario: Delivery audit is inspected
- **WHEN** an operator inspects notification dispatch history
- **THEN** the dispatch record MUST remain the delivery audit source and MUST NOT be used as the administrator's read or archive state

### Requirement: Inbox access is administrator scoped
Inbox APIs SHALL derive the recipient administrator from the authenticated server context and MUST NOT accept an arbitrary recipient ID for current-inbox read or mutation operations.

#### Scenario: Administrator lists notifications
- **WHEN** an authenticated administrator with notification read permission requests the inbox
- **THEN** the API MUST return only records addressed to that administrator
- **AND** it MUST support stable pagination and unread filtering

#### Scenario: Administrator is unauthenticated or unauthorized
- **WHEN** a request lacks an authenticated administrator or the required notification permission
- **THEN** the API MUST reject the request without revealing inbox existence or contents

#### Scenario: Administrator mutates another inbox record
- **WHEN** an administrator attempts to read or archive a record addressed to another administrator
- **THEN** the API MUST reject or conceal the record without modifying it

### Requirement: Administrators manage inbox lifecycle
The platform SHALL expose typed operations for retrieving unread count, marking an owned notification read or unread, marking all owned notifications read, and archiving an owned notification.

#### Scenario: Administrator reads a notification
- **WHEN** an administrator marks an owned unread notification as read
- **THEN** the record MUST store the read timestamp idempotently and the unread count MUST decrease accordingly

#### Scenario: Administrator marks all notifications read
- **WHEN** an administrator marks all owned notifications read
- **THEN** every unarchived unread record in that administrator's inbox MUST receive a read timestamp without changing other administrators' records

#### Scenario: Administrator archives a notification
- **WHEN** an administrator archives an owned notification
- **THEN** the record MUST store the archive timestamp and default inbox listings MUST exclude it

### Requirement: Provider availability reflects executable delivery providers
Server composition SHALL expose queued notification providers only for provider keys that have a concrete delivery implementation registered in the corresponding queue consumer.

#### Scenario: Built-in runtime starts without notification plugins
- **WHEN** the server starts with the notification queue configured and no notification provider plugins active
- **THEN** request composition MUST expose only the built-in `in-app` provider
- **AND** the queue consumer MUST register the built-in in-app delivery provider

#### Scenario: External channel is requested without a plugin
- **WHEN** a caller requests email, SMS, webhook, or another external provider that has no active implementation
- **THEN** the request MUST fail as an unavailable provider before work is accepted for queue delivery

#### Scenario: Queue consumer processes in-app work
- **WHEN** the queue consumer resolves the built-in `in-app` provider
- **THEN** it MUST execute the persistent inbox delivery implementation and MUST NOT invoke a queue-publishing provider recursively

### Requirement: Inbox capability is discoverable by the admin application
The notification-event module SHALL contribute permission-aware admin metadata and typed API references for inbox listing, unread count, read-state mutation, and archive operations, and the host admin application SHALL render an accessible administrator inbox experience.

#### Scenario: Authorized administrator opens the admin application
- **WHEN** the admin metadata composition includes the notification-event module and the administrator has notification read permission
- **THEN** the application MUST be able to discover the inbox surface and its typed operations without importing server runtime or Cloudflare binding code

#### Scenario: Administrator receives an unread notification
- **WHEN** the authenticated administrator has one or more unread inbox records
- **THEN** the admin header MUST present an accessible notification control with the unread state
- **AND** opening the control MUST show a bounded recent-notification list with loading, empty, error, read, and archive states

#### Scenario: Administrator opens notification history
- **WHEN** the administrator follows the inbox history action
- **THEN** the application MUST open an authenticated notifications screen with paginated owned records and unread or archived filtering
- **AND** read or archive actions MUST update both the screen and header unread state without a full-page reload

#### Scenario: Administrator lacks notification permission
- **WHEN** the administrator lacks the permission required by the inbox surface
- **THEN** the admin application MUST not present the inbox as available and the backend MUST continue to enforce the same permission
