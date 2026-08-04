import { Schema } from "effect";

import {
  KeyedActorKeySchema,
  KeyedActorTrimmedStringSchema,
  KeyedActorTypeSchema,
} from "./schemas";

/** Typed failure returned when an actor command cannot complete. */
export class KeyedActorCommandFailure extends Schema.TaggedErrorClass<KeyedActorCommandFailure>()(
  "KeyedActorCommandFailure",
  {
    actorKey: KeyedActorKeySchema,
    actorType: KeyedActorTypeSchema,
    commandId: KeyedActorTrimmedStringSchema,
    commandName: KeyedActorTrimmedStringSchema,
    message: KeyedActorTrimmedStringSchema,
    retryable: Schema.Boolean,
  }
) {}
