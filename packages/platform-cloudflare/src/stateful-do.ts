import { KeyedActorStateOwnershipSchema } from "@ecommerce/core/stateful";
import { DurableObject } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import { createKeyedActorDurableObjectHandler } from "./stateful-host";
import type { CloudflareKeyedActorDurableObjectHandler } from "./stateful-host";

type KeyedActorDurableObjectEnv = Record<string, unknown>;

/**
 * Cloudflare's first generic implementation of the portable keyed actor.
 *
 * This coordinator acknowledges and deduplicates commands. Actor classes with
 * domain behavior should compose the same host with their own typed command
 * handler; the host always owns message decoding, timers, and durable storage.
 */
export class KeyedActorDurableObject extends DurableObject<KeyedActorDurableObjectEnv> {
  readonly #host: CloudflareKeyedActorDurableObjectHandler;

  constructor(ctx: DurableObjectState, env: KeyedActorDurableObjectEnv) {
    super(ctx, env);
    this.#host = createKeyedActorDurableObjectHandler({
      clock: {
        now: () => new Date(),
      },
      expectedActorName: ctx.id.name,
      handle: () => Effect.succeed({ output: null }),
      ownership: (command) =>
        Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
          actorType: command.actor.type,
          classification: "coordination",
          owner: "actor-local",
          recoverySource: "recomputed",
          schemaVersion: command.schemaVersion,
          stateName: "command-coordination",
        }),
      storage: {
        delete: (key) => ctx.storage.delete(key),
        deleteAlarm: () => ctx.storage.deleteAlarm(),
        get: (key) => ctx.storage.get(key),
        list: (options) => ctx.storage.list(options),
        put: (key, value) => ctx.storage.put(key, value),
        putMany: (entries) => ctx.storage.put(entries),
        setAlarm: (scheduledTime) => ctx.storage.setAlarm(scheduledTime),
      },
    });
  }

  fetch(request: Request): Promise<Response> {
    return this.#host.fetch(request);
  }

  alarm(): Promise<void> {
    return this.#host.alarm();
  }
}

/**
 * Temporary export alias retained for Cloudflare migration compatibility.
 *
 * @deprecated Bind and export `KeyedActorDurableObject`; task 12.5 removes
 * this alias after every deployed stage has adopted the new class name.
 */
export { KeyedActorDurableObject as StatefulCoordinatorDurableObject };
