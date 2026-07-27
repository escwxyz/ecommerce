import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  createInMemoryWorkflowRecoveryHarness,
  createSequenceIdGenerator,
  createStaticClock,
} from "../../testing/index";
import { defineWorkflow, defineWorkflowStep } from "../index";

class RetryableInventoryFailure extends Error {
  readonly _tag = "RetryableInventoryFailure";
  readonly retryable = true;
}

describe("in-memory workflow recovery harness", () => {
  it("preserves Effect interruption without recording a failed step or compensation", async () => {
    let compensationCalls = 0;
    const harness = createInMemoryWorkflowRecoveryHarness({
      clock: createStaticClock(new Date("2026-07-26T10:30:00.000Z")),
      ids: createSequenceIdGenerator(["run_interrupt_1", "evt_started"]),
    });
    const workflow = defineWorkflow({
      key: "checkout.interrupt",
      schemaVersion: 1,
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          compensation: {
            name: "release-inventory",
            compensate: () =>
              Effect.sync(() => {
                compensationCalls += 1;
              }),
          },
          run: () => Effect.interrupt,
        }),
      ],
    });

    await expect(
      harness.createRuntime().start({
        workflow,
        input: { cartId: "cart_1" },
        correlationId: "corr_interrupt_1",
        idempotencyKey: "checkout:interrupt:cart_1",
      })
    ).rejects.toThrow("interrupted");

    expect(harness.state.states.get("run_interrupt_1")).toMatchObject({
      attempts: [],
      nextStepIndex: 0,
      status: "running",
    });
    expect(compensationCalls).toBe(0);
  });

  it("retries retryable step failures and persists each disposition", async () => {
    let attempts = 0;
    const harness = createInMemoryWorkflowRecoveryHarness({
      clock: createStaticClock(new Date("2026-07-26T10:45:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_retry_1",
        "evt_started",
        "evt_failed_1",
        "evt_failed_2",
        "evt_succeeded",
        "evt_completed",
      ]),
    });
    const workflow = defineWorkflow({
      key: "checkout.retry",
      schemaVersion: 1,
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          retryPolicy: {
            backoffMillis: [25, 50],
            maxAttempts: 3,
            maxDelayMillis: 40,
            retryableErrorTags: ["RetryableInventoryFailure"],
          },
          run: (_input, context) => {
            attempts += 1;
            return context.attempt < 3
              ? Effect.fail(
                  new RetryableInventoryFailure("inventory unavailable")
                )
              : Effect.succeed({
                  output: { reservationId: "res_retry_1" },
                });
          },
        }),
      ],
    });

    const result = await harness.createRuntime().start({
      workflow,
      input: { cartId: "cart_1" },
      correlationId: "corr_retry_1",
      idempotencyKey: "checkout:retry:cart_1",
    });

    expect(attempts).toBe(3);
    expect(result.status).toBe("completed");
    expect(result.attempts?.map((attempt) => attempt.attempt)).toEqual([
      1, 2, 3,
    ]);
    expect(result.attempts?.map((attempt) => attempt.retryDisposition)).toEqual(
      ["retry", "retry", undefined]
    );
    expect(result.attempts?.map((attempt) => attempt.scheduledRetryAt)).toEqual(
      [
        new Date("2026-07-26T10:45:00.025Z"),
        new Date("2026-07-26T10:45:00.040Z"),
        undefined,
      ]
    );
    expect(
      result.attempts?.slice(0, 2).map((attempt) => attempt.error)
    ).toEqual([
      {
        message: "inventory unavailable",
        name: "Error",
        retryable: true,
        tag: "RetryableInventoryFailure",
      },
      {
        message: "inventory unavailable",
        name: "Error",
        retryable: true,
        tag: "RetryableInventoryFailure",
      },
    ]);
    expect(harness.state.states.get(result.runId)?.nextStepIndex).toBe(1);
  });

  it("resumes the pending retry attempt after interruption", async () => {
    const observedAttempts: number[] = [];
    let interruptAttempt = true;
    const harness = createInMemoryWorkflowRecoveryHarness({
      clock: createStaticClock(new Date("2026-07-26T10:50:00.000Z")),
      ids: createSequenceIdGenerator([
        "run_retry_interrupt_1",
        "evt_started",
        "evt_failed",
        "evt_succeeded",
        "evt_completed",
      ]),
    });
    const workflow = defineWorkflow({
      key: "checkout.retry-interruption",
      schemaVersion: 1,
      version: 1,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          retryPolicy: {
            maxAttempts: 3,
            retryableErrorTags: ["RetryableInventoryFailure"],
          },
          run: (_input, context) => {
            observedAttempts.push(context.attempt);
            if (context.attempt === 1) {
              return Effect.fail(
                new RetryableInventoryFailure("inventory unavailable")
              );
            }
            if (interruptAttempt) {
              interruptAttempt = false;
              return Effect.interrupt;
            }
            return Effect.succeed({
              output: { reservationId: "res_recovered_retry_1" },
            });
          },
        }),
      ],
    });
    const request = {
      workflow,
      input: { cartId: "cart_1" },
      correlationId: "corr_retry_interrupt_1",
      idempotencyKey: "checkout:retry-interrupt:cart_1",
    } as const;

    await expect(harness.createRuntime().start(request)).rejects.toThrow(
      "interrupted"
    );
    expect(
      harness.state.states.get("run_retry_interrupt_1")?.attempts
    ).toMatchObject([
      {
        attempt: 1,
        retryDisposition: "retry",
        status: "failed",
      },
    ]);

    const recovered = await harness.createRuntime().start(request);

    expect(observedAttempts).toEqual([1, 2, 2]);
    expect(recovered.status).toBe("completed");
    expect(recovered.attempts?.map((attempt) => attempt.attempt)).toEqual([
      1, 2,
    ]);
    expect(harness.state.states.get(recovered.runId)?.nextStepIndex).toBe(1);
  });

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

    expect(executedSteps).toEqual(["reserve-inventory", "authorize-payment"]);
    expect(recovered.status).toBe("completed");
    expect(recovered.output).toEqual({
      completedSteps: ["reserve-inventory", "authorize-payment"],
    });
    expect(harness.state.states.get(recovered.runId)?.nextStepIndex).toBe(2);
  });

  it("persists failed step and compensation outcomes for deterministic replay", async () => {
    let compensationCalls = 0;
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
            compensate: () =>
              Effect.sync(() => {
                compensationCalls += 1;
              }),
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

    const replayed = await harness.createRuntime().start({
      workflow,
      input: { cartId: "cart_1" },
      correlationId: "corr_compensate_1",
      idempotencyKey: "checkout:cart_1",
    });

    expect(replayed.runId).toBe(result.runId);
    expect(replayed.status).toBe("compensated");
    expect(compensationCalls).toBe(1);
  });
});
