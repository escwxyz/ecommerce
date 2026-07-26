import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createInMemoryWorkflowRecoveryHarness,
  createSequenceIdGenerator,
  createStaticClock,
} from "../../testing/index";
import { defineWorkflow, defineWorkflowStep } from "../index";

describe("in-memory workflow recovery harness", () => {
  it("resumes from persisted state without re-running completed steps", async () => {
    const executedSteps: string[] = [];
    const harness = createInMemoryWorkflowRecoveryHarness({
      clock: createStaticClock(new Date("2026-07-26T11:00:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_recover_1",
        "evt_started",
        "evt_step_1",
        "evt_step_2",
        "evt_completed",
      ]),
    });
    const workflow = defineWorkflow({
      key: "checkout.recover",
      schemaVersion: 1,
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          run: () =>
            Effect.sync(() => {
              executedSteps.push("reserve-inventory");
              return { output: { reservationId: "res_1" } };
            }),
        }),
        defineWorkflowStep({
          name: "authorize-payment",
          run: () =>
            Effect.sync(() => {
              executedSteps.push("authorize-payment");
              return { output: { paymentId: "pay_1" } };
            }),
        }),
      ],
      resolveOutput: (attempts) => ({
        completedSteps: attempts
          .filter((attempt) => attempt.status === "completed")
          .map((attempt) => attempt.stepName),
      }),
    });

    await expect(
      harness.createRuntime({ interruptAfterCompletedSteps: 1 }).start({
        workflow,
        input: { cartId: "cart_1" },
        correlationId: "corr_recover_1",
        idempotencyKey: "checkout:cart_1",
      })
    ).rejects.toThrow("interrupted");

    expect(harness.state.states.get("run_recover_1")?.nextStepIndex).toBe(1);
    expect(executedSteps).toEqual(["reserve-inventory"]);

    const recovered = await harness.createRuntime().start({
      workflow,
      input: { cartId: "cart_1" },
      correlationId: "corr_recover_1",
      idempotencyKey: "checkout:cart_1",
    });

    expect(executedSteps).toEqual([
      "reserve-inventory",
      "authorize-payment",
    ]);
    expect(recovered.status).toBe("completed");
    expect(recovered.output).toEqual({
      completedSteps: ["reserve-inventory", "authorize-payment"],
    });
    expect(harness.state.states.get(recovered.runId)?.nextStepIndex).toBe(2);
  });

  it("persists failed step and compensation outcomes for deterministic replay", async () => {
    const harness = createInMemoryWorkflowRecoveryHarness({
      clock: createStaticClock(new Date("2026-07-26T12:00:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_compensate_1",
        "evt_started",
        "evt_step_1",
        "evt_step_failed",
        "evt_compensation_started",
        "evt_compensation_completed",
        "evt_failed",
      ]),
    });
    const workflow = defineWorkflow({
      key: "checkout.compensate",
      schemaVersion: 1,
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          compensation: {
            name: "release-inventory",
            compensate: () => Effect.void,
          },
          run: () =>
            Effect.succeed({
              output: { reservationId: "res_1" },
            }),
        }),
        defineWorkflowStep({
          name: "authorize-payment",
          run: () => Effect.fail(new Error("payment declined")),
        }),
      ],
    });

    const result = await harness.createRuntime().start({
      workflow,
      input: { cartId: "cart_1" },
      correlationId: "corr_compensate_1",
      idempotencyKey: "checkout:cart_1",
    });
    const state = harness.state.states.get(result.runId);

    expect(result.status).toBe("compensated");
    expect(state?.attempts.map((attempt) => attempt.phase)).toEqual([
      "run",
      "run",
      "compensation",
    ]);
    expect(state?.attempts.map((attempt) => attempt.status)).toEqual([
      "completed",
      "failed",
      "compensated",
    ]);
    expect(state?.attempts[1]?.retryDisposition).toBe("compensate");
  });
});
