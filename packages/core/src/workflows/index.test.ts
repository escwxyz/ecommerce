import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createEventCollector,
  createInMemoryWorkflowMetadataStore,
  createInMemoryWorkflowRuntime,
  createSequenceIdGenerator,
  createStaticClock,
} from "../testing/index";
import {
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  defineWorkflow,
  defineWorkflowStep,
} from "./index";

describe("workflow runtime contracts", () => {
  it("deduplicates workflow starts by idempotency key", async () => {
    const { workflowPublisher: publisher } = createEventCollector();
    const runtime = createInMemoryWorkflowRuntime({
      clock: createStaticClock(new Date("2026-06-03T08:00:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_1",
        "evt_1",
        "evt_2",
        "evt_3",
        "evt_4",
      ]),
      publisher,
    });

    const workflow = defineWorkflow({
      key: "order.fulfillment",
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-stock",
          run: () =>
            Effect.succeed({
              output: { reserved: true },
            }),
        }),
      ],
    });

    const first = await Effect.runPromise(
      runtime.start({
        workflow,
        input: { orderId: "ord_1" },
        correlationId: "corr_1",
        idempotencyKey: "order:ord_1",
      })
    );

    const second = await Effect.runPromise(
      runtime.start({
        workflow,
        input: { orderId: "ord_1" },
        correlationId: "corr_1",
        idempotencyKey: "order:ord_1",
      })
    );

    expect(second.runId).toBe(first.runId);
  });

  it("records reverse-order compensation when a later step fails", async () => {
    const { events, workflowPublisher: publisher } = createEventCollector();
    const metadata = createInMemoryWorkflowMetadataStore();
    const runtime = createInMemoryWorkflowRuntime({
      clock: createStaticClock(new Date("2026-06-03T09:00:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_2",
        "evt_10",
        "evt_11",
        "evt_12",
        "evt_13",
        "evt_14",
        "evt_15",
      ]),
      metadataStore: metadata.store,
      publisher,
    });

    const workflow = defineWorkflow({
      key: "cart.checkout",
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-stock",
          compensation: {
            name: "release-stock",
            compensate: () => Effect.void,
          },
          run: () =>
            Effect.succeed({
              output: { reservationId: "res_1" },
            }),
        }),
        defineWorkflowStep({
          name: "charge-payment",
          run: () => Effect.fail(new Error("payment declined")),
        }),
      ],
    });

    const run = await Effect.runPromise(
      runtime.start({
        workflow,
        input: { cartId: "cart_1" },
        correlationId: "corr_2",
        idempotencyKey: "checkout:cart_1",
      })
    );

    expect(run.status).toBe("compensated");
    expect(
      run.attempts?.some((attempt) => attempt.status === "compensated")
    ).toBe(true);
    expect(
      events
        .map((event) => event.name)
        .includes(WORKFLOW_LIFECYCLE_EVENT_NAMES.compensationCompleted)
    ).toBe(true);
    expect(metadata.records.get(run.runId)?.status).toBe("compensated");
  });
});
