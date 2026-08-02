# Effect Schema Conventions

This document defines the target backend schema conventions for the Effect 4
migration. It applies to `packages/core`, backend API packages, auth contracts,
provider contracts, plugin bridges, workflows, queues, actor messages, and all
commerce modules. Frontend-only form schemas are outside this boundary.

The selected API baseline is `effect@4.0.0-beta.93`. Confirm changes against
the exact installed source before using newer Effect examples.

## Ownership and file placement

Every representation has one owner:

| Representation | Owner                      | Typical path                                                   | Purpose                                                        |
| -------------- | -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Domain         | Commerce module            | `src/domain/<subject>.schema.ts`                               | Branded IDs, value objects, invariants, internal absence       |
| API            | API group or module        | `src/api/<subject>.api-schema.ts`                              | Versioned JSON request, response, pagination, and error shapes |
| Storage        | Database adapter           | `packages/db-postgres/src/modules/<module>/<subject>.table.ts` | Drizzle tables, relations, codecs, and generated row schemas   |
| Message        | Workflow/event/actor owner | `src/<boundary>/<message>.schema.ts`                           | Versioned durable payloads and bridge messages                 |

Do not import Drizzle tables or generated storage schemas into module domain or
API packages. Do not put HTTP status, database column, Cloudflare binding, or
plugin-host details in a domain schema.

## Naming

- Schema values use PascalCase nouns: `StoreId`, `Store`, `StoreApiResponse`,
  `StoreRow`, `CreateStoreRequest`.
- Use suffixes only where the representation would otherwise be ambiguous:
  `ApiRequest`, `ApiResponse`, `Row`, `Event`, `Command`, or `Error`.
- Derive types from schemas with `typeof Store.Type` or
  `Schema.Schema.Type<typeof Store>`; do not duplicate handwritten interfaces.
- Brand identifiers with a globally meaningful name such as `StoreId`, not
  generic `Id`.

## Domain schemas

Domain schemas own business-valid values:

```ts
import { Option, Schema } from "effect";

export const StoreId = Schema.NonEmptyString.pipe(Schema.brand("StoreId"));

export class Store extends Schema.Class<Store>("Store")({
  id: StoreId,
  name: Schema.NonEmptyString,
  createdAt: Schema.Date,
  description: Schema.OptionFromNullOr(Schema.String),
}) {}
```

- Use brands for identifiers and constrained primitives.
- Use `Schema.Class` when validated construction, methods, or class identity is
  useful; otherwise use `Schema.Struct`.
- Use `Option` for meaningful internal absence. Normalize nullable external
  values once at the boundary.
- Model money, quantities, status transitions, locale/currency codes, and other
  value objects with explicit checks rather than primitive aliases.
- Constructor validation is not a substitute for boundary decoding. Decode
  unknown input before constructing or invoking domain behavior.

## API schemas

API schemas are versioned serialized contracts and remain separate even when
their fields currently resemble the domain:

```ts
import { Schema } from "effect";

export const StoreApiResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  description: Schema.NullOr(Schema.String),
});
```

- `HttpApi` endpoints reference API schemas, never storage schemas.
- JSON uses strings/numbers/booleans/arrays/records and explicit `null` where
  required. Do not expose `Option`, `Date`, `BigInt`, Drizzle values, or Effect
  service types directly.
- Request and response schemas are distinct when write permissions, defaults,
  server-owned fields, or compatibility differ.
- Expected failures use `Schema.TaggedErrorClass` and are declared on the
  endpoint. Error policy details are owned by task 2.2.
- OpenAPI annotations belong on API schemas and endpoints, not domain schemas.

## PostgreSQL and Drizzle schemas

The PostgreSQL adapter owns Drizzle tables and derives Effect storage schemas:

```ts
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const storeTable = pgTable("store", {
  id: text().primaryKey(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
  description: text(),
});

export const StoreRow = createSelectSchema(storeTable, {
  id: (schema) => schema.pipe(Schema.check(Schema.isNonEmpty())),
});
export const StoreInsert = createInsertSchema(storeTable);
export const StoreUpdate = createUpdateSchema(storeTable);
```

- Generate select/insert/update schemas from the dialect-specific Drizzle
  table, then refine fields where database typing is weaker than required.
- Decode every selected row before mapping it to the domain. Encode or validate
  write parameters before executing a query.
- Database defaults, nullable columns, generated values, timestamps, numeric
  codecs, and naming conventions remain adapter concerns.
- Future dialects define their own tables and generated schemas. They conform
  through repository contract tests, not shared table definitions.

## Explicit transformations

Boundary modules export named transformations in both directions. Prefer small
typed functions over hidden structural casts:

```ts
import { Effect, Option, Schema } from "effect";

export const storeFromApi = Effect.fn("Store.fromApi")(function* (
  input: unknown
) {
  const api = yield* Schema.decodeUnknownEffect(StoreApiResponse)(input);
  return yield* Schema.decodeUnknownEffect(Store)({
    id: api.id,
    name: api.name,
    createdAt: new Date(api.createdAt),
    description: Option.fromNullishOr(api.description),
  });
});

export const storeToApi = (store: Store): typeof StoreApiResponse.Type => ({
  id: store.id,
  name: store.name,
  createdAt: store.createdAt.toISOString(),
  description: Option.getOrNull(store.description),
});
```

Use Effect's built-in transformations such as `Schema.DateFromString` when
their encoded and decoded contracts match the boundary. For custom
`Schema.decodeTo` transformations, verify both decode and encode directions;
the beta.93 getter naming is easy to interpret backwards.

Never transform representations with `as`, object spreading plus an asserted
return type, unchecked `JSON.parse`, or a Drizzle result cast.

## Boundary decoding policy

Decode `unknown` at every trust boundary:

- HTTP path, query, headers, cookies, and body;
- environment and configuration providers;
- PostgreSQL query results and JSON columns;
- events, queues, workflow state, Durable Object commands, and alarms;
- provider webhooks and third-party API responses;
- native plugin manifests and sandbox bridge messages.

Native trusted-plugin manifests use
`@ecommerce/core/plugins`'s `NativePluginManifestSchema`. The schema versions
the manifest, validates plugin identity and semantic version, and requires each
portable capability to declare a namespaced key plus whether it is required.
Capability keys identify runtime-neutral service contracts; they are not auth
permissions and must not name Cloudflare bindings, SQL/Drizzle clients,
secrets, or another concrete runtime. Executable Layers and contribution
implementations are deliberately outside the serializable manifest. Trusted
plugin services and providers pair portable service tags with implementation
Layers; API contributions retain their `HttpApiGroup` schemas and handler
Layers; workflow and event contributions retain typed Effect requirements plus
the Layers that satisfy them. Runtime composition validates the manifest before
using any of these executable values. It also validates every required
capability against the host-supplied portable capability set and rejects
duplicate executable contribution keys or storage namespaces before Layer
construction.

Workflow durable messages use `@ecommerce/core/workflows` schemas for
descriptors, persisted run state, step outcomes, retry policy, retry
disposition, and compensation policy. Executable `Effect` handlers stay on
workflow definitions and are not persisted; adapters persist only the
schema-versioned descriptor/state shapes and replay completed step outcomes
before invoking idempotent side effects.

Keyed actor durable messages use `@ecommerce/core/stateful` schemas for actor
references, commands, command results, timers, state snapshots, and state
ownership. Adapters decode these schemas before actor dispatch or persistence.
Ownership metadata is part of the durable state contract: PostgreSQL remains
the relational authority unless an accepted design reference explicitly
assigns a relational record to actor-local storage.

The Cloudflare adapter wraps those canonical messages in an operation-tagged
Durable Object request/response protocol. Both the namespace Layer and Durable
Object host decode their side of the exchange; stored command results, timers,
and snapshots are decoded again on read so corrupted or obsolete durable state
becomes a typed adapter failure instead of entering actor logic.

Use `Schema.decodeUnknownEffect` in Effect programs. `decodeUnknownSync` is
limited to deterministic initialization or tests where a thrown schema defect
is intentionally fatal. Do not call a Zod-style `.parse()` compatibility
method in migrated backend code.

## Evolution and testing

Each boundary schema requires tests for:

- a representative successful decode and encode;
- each important refinement or invariant failure;
- nullable/optional normalization;
- domain/API and storage/domain transformations in both directions;
- unknown/extra-field behavior where security or compatibility depends on it;
- generated OpenAPI or durable-message compatibility when the boundary is
  externally or durably versioned.

Schema changes that alter stored rows, public APIs, durable messages, or plugin
bridges require an OpenSpec requirement and migration/compatibility decision.
