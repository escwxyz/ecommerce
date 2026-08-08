import { Effect } from "effect";

import type { CheckoutCompletionResult } from "../domain";
import { CheckoutCompletionFailure } from "../domain";
import type {
  CheckoutCompletionClaim,
  CheckoutCompletionEvent,
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
    const runs = new Map<
      string,
      | { readonly status: "running"; readonly workflowRunId: string }
      | {
          readonly completionEvent: CheckoutCompletionEvent;
          readonly result: CheckoutCompletionResult;
          readonly status: "completed";
        }
    >();

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
          if (existing?.status === "completed") {
            return Effect.succeed(existing);
          }
          if (existing?.status === "running") {
            return Effect.fail(
              new CheckoutCompletionFailure({
                message: `Checkout "${input.idempotencyKey}" is already running.`,
                workflowRunId: existing.workflowRunId,
              })
            );
          }

          runs.set(key, { status: "running", workflowRunId });
          return Effect.succeed({
            status: "acquired",
            workflowRunId,
          } as const);
        }),
      complete: (input, result, completionEvent) =>
        Effect.sync(() => {
          runs.set(createCheckoutCompletionKey(input), {
            completionEvent,
            result,
            status: "completed",
          });
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
          if (runs.get(key)?.status === "running") {
            runs.delete(key);
          }
        }),
    };
  };
