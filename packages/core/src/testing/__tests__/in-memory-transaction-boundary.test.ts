import { describe, expect, it } from "bun:test";

import { Cause, Effect, Exit } from "effect";

import type { OutboxPersistenceFailure } from "../../persistence/index";
import {
  createInMemoryOutbox,
  createInMemoryTransactionBoundary,
} from "../index";

describe("deterministic in-memory transaction boundary", () => {
  it("rolls back every registered resource when a mutation is interrupted", async () => {
    let state = "before";
    const resource = {
      captureRollback: Effect.sync(() => {
        const snapshot = state;
        return Effect.sync(() => {
          state = snapshot;
        });
      }),
    };
    const boundary = createInMemoryTransactionBoundary({
      resources: [resource],
    });

    const exit = await Effect.runPromiseExit(
      boundary.withTransaction(
        Effect.sync(() => {
          state = "during";
        }).pipe(Effect.andThen(Effect.interrupt))
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(state).toBe("before");
  });

  it("retains the original failure and rollback defect in one Cause", async () => {
    const boundary = createInMemoryTransactionBoundary({
      resources: [
        {
          captureRollback: Effect.succeed(
            Effect.die(new Error("rollback failed"))
          ),
        },
      ],
    });
    const exit = await Effect.runPromiseExit(
      boundary.withTransaction(Effect.fail("mutation failed"))
    );

    if (Exit.isSuccess(exit)) {
      throw new Error("Expected the transaction to fail.");
    }

    expect(Cause.hasFails(exit.cause)).toBe(true);
    expect(Cause.hasDies(exit.cause)).toBe(true);
    expect(String(exit.cause)).toContain("mutation failed");
    expect(String(exit.cause)).toContain("rollback failed");
  });

  it("deduplicates the same logical outbox message inside a transaction", async () => {
    const outbox = createInMemoryOutbox({
      recordIds: ["outbox_1", "outbox_2"],
    });
    const boundary = createInMemoryTransactionBoundary({
      resources: [outbox],
    });
    const message = {
      event: {
        emittedAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "event_1",
        name: "cart.line-item-added",
        payload: { cartId: "cart_1" },
      },
      idempotencyKey: "cart.line-item-added:request_1",
      topic: "commerce.events",
    } as const;

    await Effect.runPromise(
      boundary.withTransaction<void, OutboxPersistenceFailure, never>(
        Effect.gen(function* enqueueDuplicateOutboxIntent() {
          yield* outbox.writer.enqueue(message);
          yield* outbox.writer.enqueue(message);
        })
      )
    );

    expect(outbox.records).toHaveLength(1);
    expect(outbox.records[0]?.recordId).toBe("outbox_1");
  });
});
