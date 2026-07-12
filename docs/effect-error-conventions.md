# Effect Error Conventions

Backend services expose expected failures in their Effect error channel as
closed unions of module-owned `Schema.TaggedErrorClass` values. Each error name
describes an actionable condition such as `StoreNotFound`,
`StoreNameConflict`, or `StorePersistenceUnavailable`; a generic application
error is not a module contract.

## Expected failures

- Define errors beside the module contract that owns their meaning.
- Use schema fields that are safe and useful to callers. Do not serialize raw
  causes, SQL text, credentials, provider bodies, stacks, or internal messages.
- Match errors by `_tag` with `Effect.catchTag`, `Effect.catchTags`, or `Match`.
- Keep error unions closed at public module, workflow-step, and API boundaries.
- Give each declared API error an explicit response schema and deterministic
  HTTP status when the Effect HTTP foundation is implemented.

```ts
import { Schema } from "effect";

export class StoreNotFound extends Schema.TaggedErrorClass<StoreNotFound>()(
  "StoreNotFound",
  { storeId: Schema.NonEmptyString }
) {}
```

## Boundary translation

Adapters own foreign failures. Wrap throwing or Promise APIs with `Effect.try`
or `Effect.tryPromise` and translate the caught value immediately to a declared
adapter or module error. Repository, provider, Better Auth, and platform error
types must not escape their boundary.

Do not use `catchCause` to turn every Cause into an expected error. That
would misclassify defects and interruptions. Use ordinary typed-channel
operators such as `mapError`, `catchTag`, or the `catch` callback of
`Effect.try`/`Effect.tryPromise` for expected translation.

## Defects and interruptions

Invariant violations and programming bugs are defects. Cancellation and
timeouts that interrupt fibers remain interruptions. Neither belongs in a
module's expected error union merely to simplify transport handling.

Use `classifyCause` for Cause-aware telemetry and `observeCause` when recording
an outcome without changing it. A Cause may contain failures, defects, and
interruptions together, so classification uses independent flags and retains
the complete Cause for internal diagnostics. Transport boundaries sanitize
unexpected failures without exposing Cause details.

## Tests

Place new tests in a nested `__tests__/` folder within the source area they
cover. For example, error policy tests belong at
`src/errors/__tests__/effect-error-policy.test.ts`, not beside the production
module. Existing colocated tests are historical and can move when their area is
next changed.

Every module error contract must verify schema encoding and tag-based recovery.
Every adapter boundary must verify foreign failure translation and protected
detail removal. Cause-handling code must separately test expected failures,
defects, interruptions, and any relevant composite Cause.
