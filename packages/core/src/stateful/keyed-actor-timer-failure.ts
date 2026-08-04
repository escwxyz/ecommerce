import { Schema } from "effect";

import {
  KeyedActorKeySchema,
  KeyedActorTrimmedStringSchema,
  KeyedActorTypeSchema,
} from "./schemas";

/** Typed failure returned by actor timer persistence or scheduling. */
export class KeyedActorTimerFailure extends Schema.TaggedErrorClass<KeyedActorTimerFailure>()(
  "KeyedActorTimerFailure",
  {
    actorKey: KeyedActorKeySchema,
    actorType: KeyedActorTypeSchema,
    message: KeyedActorTrimmedStringSchema,
    retryable: Schema.Boolean,
    timerId: KeyedActorTrimmedStringSchema,
  }
) {}
