## ADDED Requirements

### Requirement: Effect auth provider options are evaluated before replacing the temporary seam

The platform SHALL evaluate direct Better Auth wrapping, the community
`effectify` integration, and future official support before replacing,
expanding, or deleting the temporary Better Auth Effect adapter and persistence
seam.

#### Scenario: Auth provider seam is ready to change

- **WHEN** an implementation task proposes replacing the current private Better
  Auth adapter or changing Better Auth-owned persistence
- **THEN** the direct wrapping, `effectify`, and official-support options MUST
  have a documented comparison and selected path first

### Requirement: Provider choice preserves the Effect auth boundary

The selected auth provider integration SHALL preserve
`EffectAuthServiceTag` and the Effect Schema auth contracts as the public auth
boundary for modules, API handlers, workflows, plugins, and SDK-facing server
code.

#### Scenario: A commerce module needs identity or permission data

- **WHEN** a commerce module needs the current user, session, role, or
  permissions
- **THEN** it MUST depend on the Effect auth contracts rather than Better Auth,
  `effectify`, provider database tables, D1 bindings, or Kysely auth types

### Requirement: Provider choice is Cloudflare Worker compatible

The selected auth provider integration SHALL run in the Cloudflare Worker
runtime without requiring Node HTTP server APIs.

#### Scenario: Auth is evaluated in the Worker runtime

- **WHEN** the Cloudflare Worker handles a protected API request
- **THEN** the selected provider path MUST validate session cookies and map auth
  failures using Worker-compatible Request, Headers, and fetch primitives

### Requirement: Provider choice includes persistence ownership

The selected auth provider integration SHALL document whether auth persistence
remains provider-private or moves to a new Effect SQL / Drizzle-owned storage
path.

#### Scenario: Kysely removal reaches auth-owned storage

- **WHEN** Kysely-backed or D1-backed auth persistence is considered for removal
- **THEN** the auth provider decision MUST define the migration, retention, or
  deletion plan for Better Auth-owned tables and generated migrations

### Requirement: Provider choice preserves sanitized failure behavior

The selected auth provider integration SHALL preserve sanitized transport
failures for missing sessions, expired sessions, denied permissions, and
provider-rejected auth calls.

#### Scenario: Provider returns or throws an internal failure

- **WHEN** the auth provider rejects a session lookup or returns malformed data
- **THEN** protected API responses MUST NOT expose provider internals, secrets,
  database details, stack traces, or raw Better Auth / `effectify` error shapes
