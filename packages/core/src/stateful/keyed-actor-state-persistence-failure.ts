import { Schema } from "effect";

import {
  KeyedActorKeySchema,
  KeyedActorTrimmedStringSchema,
  KeyedActorTypeSchema,
} from "./schemas";

/** Typed failure returned by actor-local state persistence. */
export class KeyedActorStatePersistenceFailure extends Schema.TaggedErrorClass<KeyedActorStatePersistenceFailure>()(
  "KeyedActorStatePersistenceFailure",
  {
    actorKey: KeyedActorKeySchema,
    actorType: KeyedActorTypeSchema,
    message: KeyedActorTrimmedStringSchema,
    retryable: Schema.Boolean,
    stateName: KeyedActorTrimmedStringSchema,
  }
) {}
