import { Schema } from "effect";

/** Expected failure emitted when required audit evidence cannot be stored. */
export class AuditPersistenceUnavailable extends Schema.TaggedErrorClass<AuditPersistenceUnavailable>()(
  "AuditPersistenceUnavailable",
  { eventType: Schema.NonEmptyString }
) {}
