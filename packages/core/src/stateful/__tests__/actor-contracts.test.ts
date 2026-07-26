import { describe, expect, it } from "bun:test";

import { Effect, Option, Schema } from "effect";

import {
  KeyedActorCommandSchema,
  KeyedActorService,
  KeyedActorStateOwnershipSchema,
  KeyedActorStateSnapshotSchema,
  KeyedActorStateStoreService,
  KeyedActorTimerSchema,
  KeyedActorTimerService,
} from "../index";
import { createInMemoryKeyedActorTestLayer } from "../testing";

describe("keyed actor durable contracts", () => {
  it("rejects actor commands without a durable schema version", () => {
    expect(() =>
      Schema.decodeUnknownSync(KeyedActorCommandSchema)({
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
      })
    ).toThrow();
  });

  it("rejects timers with a non-canonical due time", () => {
    expect(() =>
      Schema.decodeUnknownSync(KeyedActorTimerSchema)({
        command: {
          actor: {
            key: "cart_1",
            type: "cart",
          },
          commandId: "command_cart_expire",
          commandName: "cart.expire",
          correlationId: "timer_cart_expire",
          idempotencyKey: "cart:cart_1:expire",
          issuedAt: "2026-07-26T13:00:00.000Z",
          payload: {},
          schemaVersion: 1,
        },
        dueAt: "tomorrow",
        scheduledAt: "2026-07-26T13:00:00.000Z",
        schemaVersion: 1,
        timerId: "timer_cart_expire",
        timerName: "cart.expiration",
      })
    ).toThrow();
  });

  it("requires an accepted design before actor-local relational ownership", () => {
    expect(() =>
      Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
        actorType: "cart",
        classification: "relational-record",
        owner: "actor-local",
        recoverySource: "actor-local",
        schemaVersion: 1,
        stateName: "cart",
      })
    ).toThrow();

    const accepted = Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
      acceptedDesignReference: "openspec/changes/adopt-cart-do-primary",
      actorType: "cart",
      classification: "relational-record",
      owner: "actor-local",
      recoverySource: "actor-local",
      schemaVersion: 1,
      stateName: "cart",
    });

    expect(accepted.acceptedDesignReference).toBe(
      "openspec/changes/adopt-cart-do-primary"
    );
  });

  it("deduplicates commands and persists actor-local coordination state", async () => {
    let handlerCalls = 0;
    const ownership = Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
      actorType: "cart",
      classification: "coordination",
      owner: "actor-local",
      recoverySource: "postgresql",
      schemaVersion: 1,
      stateName: "cart-command-deduplication",
    });
    const command = Schema.decodeUnknownSync(KeyedActorCommandSchema)({
      actor: {
        key: "cart_1",
        type: "cart",
      },
      causationId: "event_cart_item_requested",
      commandId: "command_cart_add_item",
      commandName: "cart.add-item",
      correlationId: "request_cart_add_item",
      idempotencyKey: "cart:cart_1:add-item:item_1",
      issuedAt: "2026-07-26T13:00:00.000Z",
      payload: {
        lineItemId: "item_1",
      },
      schemaVersion: 1,
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "workflow_checkout_1",
    });
    const runtime = createInMemoryKeyedActorTestLayer({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      ownership,
      handle: (input, currentState) =>
        Effect.sync(() => {
          handlerCalls += 1;
          const previous = Option.getOrUndefined(currentState);

          return {
            output: {
              accepted: true,
              subject: input.subject,
            },
            state: {
              commandsApplied: previous ? 2 : 1,
            },
          };
        }),
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const actor = yield* KeyedActorService;
        const stateStore = yield* KeyedActorStateStoreService;
        const first = yield* actor.dispatch(command);
        const duplicate = yield* actor.dispatch(command);
        const snapshot = yield* stateStore.get({
          actor: command.actor,
          stateName: ownership.stateName,
        });

        return {
          duplicate,
          first,
          snapshot: Option.getOrUndefined(snapshot),
        };
      }).pipe(Effect.provide(runtime.layer))
    );

    expect(handlerCalls).toBe(1);
    expect(result.first).toMatchObject({
      causationId: "event_cart_item_requested",
      correlationId: "request_cart_add_item",
      duplicate: false,
      output: {
        accepted: true,
        subject: {
          id: "cart_1",
          type: "cart",
        },
      },
      stateVersion: 1,
      subject: {
        id: "cart_1",
        type: "cart",
      },
      workflowRunId: "workflow_checkout_1",
    });
    expect(result.duplicate).toMatchObject({
      duplicate: true,
      stateVersion: 1,
    });
    expect(result.snapshot).toMatchObject({
      state: {
        commandsApplied: 1,
      },
      stateVersion: 1,
    });
  });

  it("stores and cancels durable timers by actor key", async () => {
    const ownership = Schema.decodeUnknownSync(KeyedActorStateOwnershipSchema)({
      actorType: "cart",
      classification: "coordination",
      owner: "actor-local",
      recoverySource: "postgresql",
      schemaVersion: 1,
      stateName: "cart-command-deduplication",
    });
    const timer = Schema.decodeUnknownSync(KeyedActorTimerSchema)({
      command: {
        actor: {
          key: "cart_1",
          type: "cart",
        },
        commandId: "command_cart_expire",
        commandName: "cart.expire",
        correlationId: "timer_cart_expire",
        idempotencyKey: "cart:cart_1:expire",
        issuedAt: "2026-07-26T13:00:00.000Z",
        payload: {},
        schemaVersion: 1,
      },
      dueAt: "2026-07-27T13:00:00.000Z",
      scheduledAt: "2026-07-26T13:00:00.000Z",
      schemaVersion: 1,
      timerId: "timer_cart_expire",
      timerName: "cart.expiration",
    });
    const runtime = createInMemoryKeyedActorTestLayer({
      clock: {
        now: () => new Date("2026-07-26T13:00:01.000Z"),
      },
      handle: () => Effect.succeed({ output: null }),
      ownership,
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const timers = yield* KeyedActorTimerService;
        yield* timers.schedule(timer);
        const scheduled = yield* timers.get({
          actor: timer.command.actor,
          timerId: timer.timerId,
        });
        const cancelled = yield* timers.cancel({
          actor: timer.command.actor,
          timerId: timer.timerId,
        });
        const afterCancel = yield* timers.get({
          actor: timer.command.actor,
          timerId: timer.timerId,
        });

        return {
          afterCancel: Option.getOrUndefined(afterCancel),
          cancelled,
          scheduled: Option.getOrUndefined(scheduled),
        };
      }).pipe(Effect.provide(runtime.layer))
    );

    expect(result.scheduled).toEqual(timer);
    expect(result.cancelled).toBe(true);
    expect(result.afterCancel).toBeUndefined();
  });

  it("rejects state ownership for a different actor type", () => {
    expect(() =>
      Schema.decodeUnknownSync(KeyedActorStateSnapshotSchema)({
        actor: {
          key: "inventory_1",
          type: "inventory",
        },
        ownership: {
          actorType: "cart",
          classification: "cache",
          owner: "actor-local",
          recoverySource: "postgresql",
          schemaVersion: 1,
          stateName: "active-cart",
        },
        schemaVersion: 1,
        state: {},
        stateVersion: 1,
        updatedAt: "2026-07-26T13:00:00.000Z",
      })
    ).toThrow();
  });
});
