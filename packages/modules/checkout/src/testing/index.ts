import { Effect } from "effect";

import { CheckoutCompletionFailure } from "../domain";
import type {
  CheckoutCompletionClaim,
  CheckoutCompletionState,
  CheckoutCompletionStoreShape,
} from "../services";

const createCheckoutCompletionKey = ({
  cartId,
  idempotencyKey,
}: {
  readonly cartId: string;
  readonly idempotencyKey: string;
}): string => `${cartId}:${idempotencyKey}`;

/** Creates deterministic isolate-local completion state for Checkout tests. */
export const createInMemoryCheckoutCompletionStore =
  (): CheckoutCompletionStoreShape => {
    const runs = new Map<string, CheckoutCompletionState>();

    return {
      claim: (
        input,
        workflowRunId
      ): Effect.Effect<CheckoutCompletionClaim, CheckoutCompletionFailure> =>
        Effect.suspend<
          CheckoutCompletionClaim,
          CheckoutCompletionFailure,
          never
        >(() => {
          const key = createCheckoutCompletionKey(input);
          const existing = runs.get(key);
          if (
            existing?.status === "completed" ||
            existing?.status === "uncertain"
          ) {
            return Effect.succeed(existing);
          }
          if (
            existing?.status === "pre-orchestration" ||
            existing?.status === "orchestration"
          ) {
            return Effect.fail(
              new CheckoutCompletionFailure({
                message: `Checkout "${input.idempotencyKey}" is already running.`,
                workflowRunId: existing.workflowRunId,
              })
            );
          }

          runs.set(key, { status: "pre-orchestration", workflowRunId });
          return Effect.succeed({
            status: "pre-orchestration",
            workflowRunId,
          } as const);
        }),
      beginOrchestration: (input, workflowRunId) =>
        Effect.suspend(() => {
          const key = createCheckoutCompletionKey(input);
          const existing = runs.get(key);
          if (
            existing?.status !== "pre-orchestration" ||
            existing.workflowRunId !== workflowRunId
          ) {
            return Effect.fail(
              new CheckoutCompletionFailure({
                message: `Checkout "${input.idempotencyKey}" cannot begin orchestration from its current state.`,
                workflowRunId,
              })
            );
          }
          runs.set(key, { status: "orchestration", workflowRunId });
          return Effect.void;
        }),
      complete: (input, result, completionEvent) =>
        Effect.suspend(() => {
          const key = createCheckoutCompletionKey(input);
          const existing = runs.get(key);
          if (
            existing?.status !== "orchestration" &&
            existing?.status !== "uncertain"
          ) {
            return Effect.fail(
              new CheckoutCompletionFailure({
                message: `Checkout "${input.idempotencyKey}" cannot complete from its current state.`,
                workflowRunId: result.workflowRunId,
              })
            );
          }
          runs.set(key, {
            completionEvent,
            result,
            status: "completed",
          });
          return Effect.void;
        }),
      markUncertain: (input, result, completionEvent) =>
        Effect.suspend(() => {
          const key = createCheckoutCompletionKey(input);
          if (runs.get(key)?.status !== "orchestration") {
            return Effect.fail(
              new CheckoutCompletionFailure({
                message: `Checkout "${input.idempotencyKey}" cannot become uncertain from its current state.`,
                workflowRunId: result.workflowRunId,
              })
            );
          }
          runs.set(key, {
            completionEvent,
            result,
            status: "uncertain",
          });
          return Effect.void;
        }),
      markCompletionEventPersisted: (input, eventId) =>
        Effect.sync(() => {
          const key = createCheckoutCompletionKey(input);
          const existing = runs.get(key);
          if (
            existing?.status === "completed" &&
            existing.completionEvent.eventId === eventId
          ) {
            runs.set(key, {
              ...existing,
              completionEvent: {
                ...existing.completionEvent,
                status: "persisted",
              },
            });
          }
        }),
      release: (input) =>
        Effect.sync(() => {
          const key = createCheckoutCompletionKey(input);
          if (runs.get(key)?.status === "pre-orchestration") {
            runs.delete(key);
          }
        }),
    };
  };
