`@ecommerce/db` is the shared database contract package.

It owns:

- adapter-agnostic database types
- Kysely database assembly and adapter descriptors
- shared migration contribution exports
- dialect helper contracts for timestamp, introspection, binary, and JSON behavior
- boundary tests that prevent runtime-specific imports

It does not own:

- Cloudflare env reads
- D1 client construction
- D1 migration SQL artifacts
- concrete D1 Kysely dialect construction

Those D1-specific concerns live in `@ecommerce/db-d1`.

Compatibility note:

- `kysely` is pinned to `0.28.17` because Better Auth's bundled Kysely adapter currently has a known incompatibility with `kysely@0.29.x` migration exports. Do not widen that version until Better Auth's adapter supports the new Kysely export layout.
- `kysely-d1@0.4.0` currently emits Kysely's outdated driver/plugin warning under `kysely@0.28.17`, but targeted D1 query and migration tests pass. Recheck this when upgrading the D1 dialect.

Follow-up note:

- The next adapter remains intentionally undecided between libSQL/SQLite portability and PostgreSQL scale-focused support. Capture that as a dedicated follow-up change when a concrete runtime requirement appears.
