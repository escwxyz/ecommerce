import { describe, expect, it } from "bun:test";

import {
  KeyedActorCommandFailure,
  KeyedActorCommandSchema,
  KeyedActorService,
  KeyedActorStateOwnershipSchema,
  KeyedActorStateStoreService,
  KeyedActorTimerSchema,
  KeyedActorTimerService,
} from "@ecommerce/core/stateful";
import { Effect, Option, Schema } from "effect";

import {
  createCloudflareKeyedActorLayer,
  createKeyedActorDurableObjectHandler,
} from "../stateful";

const command = Schema.decodeUnknownSync(KeyedActorCommandSchema)({
  actor: {
    key: "cart_1",
    type: "cart",
  },
  commandId: "command_cart_add_item",
  commandName: "cart.add-item",
  correlationId: "request_cart_add_item",
  idempotencyKey: "cart:cart_1:add-item:item_1",
  issuedAt: "2026-07-26T13:00:00.000Z",
  payload: {
    lineItemId: "item_1",
  },
  schemaVersion: 1,
});

const ownership = Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
  actorType: "cart",
  classification: "coordination",
  owner: "actor-local",
  recoverySource: "postgresql",
  schemaVersion: 1,
  stateName: "command-coordination",
});

const timer = Schema.decodeUnknownSync(KeyedActorTimerSchema)({
  command,
  dueAt: "2026-07-27T13:00:00.000Z",
  scheduledAt: "2026-07-26T13:00:00.000Z",
  schemaVersion: 1,
  timerId: "timer_cart_expire",
  timerName: "cart.expiration",
});

const createStorage = () => {
  const values = new Map<string, unknown>();
  let alarm: number | null = null;

  return {
    delete: async (key: string) => values.delete(key),
    deleteAlarm: async () => {
      alarm = null;
    },
    get: async (key: string) => values.get(key),
    getAlarm: async () => alarm,
    list: async ({ prefix }: { readonly prefix?: string } = {}) =>
      new Map(
        [...values].filter(
          ([key]) => prefix === undefined || key.startsWith(prefix)
        )
      ),
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
    putMany: async (entries: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(entries)) {
        values.set(key, value);
      }
    },
    setAlarm: async (value: number | Date) => {
      alarm = value instanceof Date ? value.getTime() : value;
    },
    values,
  };
};

describe("Cloudflare keyed actor boundary", () => {
  it("decodes commands before invoking the Durable Object handler", async () => {
    const storage = createStorage();
    let handlerCalls = 0;
    const host = createKeyedActorDurableObjectHandler({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      handle: () =>
        Effect.sync(() => {
          handlerCalls += 1;
          return {
            output: {
              accepted: true,
            },
          };
        }),
      ownership,
      storage,
    });

    const response = await host.fetch(
      new Request("https://actor.internal/", {
        body: JSON.stringify({
          command: {
            ...command,
            schemaVersion: 0,
          },
          operation: "dispatch",
        }),
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    expect(handlerCalls).toBe(0);
  });

  it("rejects a valid message routed to a different named actor", async () => {
    const storage = createStorage();
    let handlerCalls = 0;
    const host = createKeyedActorDurableObjectHandler({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      expectedActorName: "cart:cart_2",
      handle: () =>
        Effect.sync(() => {
          handlerCalls += 1;
          return { output: null };
        }),
      ownership,
      storage,
    });

    const response = await host.fetch(
      new Request("https://actor.internal/", {
        body: JSON.stringify({
          command,
          operation: "dispatch",
        }),
        method: "POST",
      })
    );

    expect(response.status).toBe(409);
    expect(handlerCalls).toBe(0);
  });

  it("deduplicates commands through durable storage and decodes results", async () => {
    const storage = createStorage();
    let handlerCalls = 0;
    const host = createKeyedActorDurableObjectHandler({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      handle: () =>
        Effect.sync(() => {
          handlerCalls += 1;
          return {
            output: {
              mutationCount: handlerCalls,
            },
            state: {
              mutationCount: handlerCalls,
            },
          };
        }),
      ownership,
      storage,
    });
    const namespace = {
      getByName: () => ({
        fetch: (request: Request) => host.fetch(request),
      }),
    };
    const layer = createCloudflareKeyedActorLayer({ namespace });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const actor = yield* KeyedActorService;
        const first = yield* actor.dispatch(command);
        const duplicate = yield* actor.dispatch(command);

        return { duplicate, first };
      }).pipe(Effect.provide(layer))
    );

    expect(handlerCalls).toBe(1);
    expect(result.first).toMatchObject({
      duplicate: false,
      output: {
        mutationCount: 1,
      },
      stateVersion: 1,
    });
    expect(result.duplicate).toMatchObject({
      duplicate: true,
      output: {
        mutationCount: 1,
      },
      stateVersion: 1,
    });
  });

  it("maps malformed Durable Object results to typed command failures", async () => {
    const layer = createCloudflareKeyedActorLayer({
      namespace: {
        getByName: () => ({
          fetch: async () =>
            Response.json({
              operation: "dispatch-result",
              result: {
                actor: command.actor,
              },
            }),
        }),
      },
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.gen(function* () {
          const actor = yield* KeyedActorService;
          return yield* actor.dispatch(command);
        }).pipe(Effect.provide(layer))
      )
    );

    expect(failure).toBeInstanceOf(KeyedActorCommandFailure);
    expect(failure.retryable).toBe(false);
  });

  it("persists schema-validated state and manages the earliest durable timer", async () => {
    const storage = createStorage();
    const host = createKeyedActorDurableObjectHandler({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      handle: () =>
        Effect.succeed({
          output: null,
          state: {
            mutationCount: 1,
          },
        }),
      ownership,
      storage,
    });
    const layer = createCloudflareKeyedActorLayer({
      namespace: {
        getByName: () => ({
          fetch: (request: Request) => host.fetch(request),
        }),
      },
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const actors = yield* KeyedActorService;
        const stateStore = yield* KeyedActorStateStoreService;
        const timers = yield* KeyedActorTimerService;
        const dispatched = yield* actors.dispatch(command);
        yield* timers.schedule(timer);
        const scheduled = yield* timers.get({
          actor: command.actor,
          timerId: timer.timerId,
        });
        const state = yield* stateStore.get({
          actor: command.actor,
          stateName: ownership.stateName,
        });

        return {
          dispatched,
          scheduled: Option.getOrUndefined(scheduled),
          state: Option.getOrUndefined(state),
        };
      }).pipe(Effect.provide(layer))
    );

    expect(result.scheduled).toEqual(timer);
    expect(result.state).toMatchObject({
      state: {
        mutationCount: 1,
      },
      stateVersion: 1,
    });
    expect(await storage.getAlarm()).toBe(new Date(timer.dueAt).getTime());
  });
});
