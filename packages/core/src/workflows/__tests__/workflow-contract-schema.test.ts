import { describe, expect, it } from "bun:test";

import { Effect, Schema } from "effect";

import {
  CommerceWorkflowDefinitionDescriptorSchema,
  CommerceWorkflowRunStateSchema,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  defineWorkflow,
  defineWorkflowStep,
  describeWorkflowDefinition,
} from "../index";

describe("workflow durable contracts", () => {
  it("describes executable definitions as schema-versioned durable metadata", () => {
    const workflow = defineWorkflow({
      key: "checkout.complete",
      schemaVersion: 2,
      version: 3,
      steps: [
        defineWorkflowStep({
          name: "reserve-inventory",
          retryPolicy: {
            backoffMillis: [100, 500],
            maxAttempts: 3,
            retryableErrorTags: ["InventoryUnavailable"],
          },
          schemaVersion: 4,
          run: () => Effect.succeed({ output: { reservationId: "res_1" } }),
          compensation: {
            name: "release-inventory",
            policy: {
              idempotencyScope: "step",
              required: true,
              stepName: "release-inventory",
            },
            compensate: () => Effect.void,
          },
        }),
      ],
    });

    const decoded = Schema.decodeUnknownSync(
      CommerceWorkflowDefinitionDescriptorSchema
    )(describeWorkflowDefinition(workflow));

    expect(String(decoded.key)).toBe("checkout.complete");
    expect(decoded.schemaVersion).toBe(2);
    expect(decoded.version).toBe(3);
    expect(decoded.steps[0]).toEqual({
      compensation: {
        idempotencyScope: "step",
        required: true,
        stepName: "release-inventory",
      },
      name: "reserve-inventory",
      retryPolicy: {
        backoffMillis: [100, 500],
        maxAttempts: 3,
        retryableErrorTags: ["InventoryUnavailable"],
      },
      schemaVersion: 4,
    });
  });

  it("rejects unversioned durable workflow state", () => {
    const persistedState = {
      attempts: [],
      correlationId: "corr_checkout_1",
      createdAt: "2026-07-26T10:00:00.000Z",
      input: { cartId: "cart_1" },
      nextStepIndex: 0,
      runId: "run_checkout_1",
      status: "running",
      updatedAt: "2026-07-26T10:00:00.000Z",
      workflowKey: "checkout.complete",
      workflowVersion: 1,
    };

    expect(() =>
      Schema.decodeUnknownSync(CommerceWorkflowRunStateSchema)(persistedState)
    ).toThrow();
  });

  it("validates persisted step outcomes, retries, and compensation markers", () => {
    const decoded = Schema.decodeUnknownSync(CommerceWorkflowRunStateSchema)({
      attempts: [
        {
          attempt: 1,
          completedAt: "2026-07-26T10:00:01.000Z",
          output: { reservationId: "res_1" },
          phase: "run",
          startedAt: "2026-07-26T10:00:00.000Z",
          status: "completed",
          stepId: "run_checkout_1:reserve-inventory:1",
          stepName: "reserve-inventory",
        },
        {
          attempt: 1,
          error: {
            message: "payment declined",
            name: "PaymentAuthorizationDeclined",
            retryable: false,
            tag: "PaymentAuthorizationDeclined",
          },
          phase: "run",
          retryDisposition: "compensate",
          startedAt: "2026-07-26T10:00:02.000Z",
          status: "failed",
          stepId: "run_checkout_1:authorize-payment:2",
          stepName: "authorize-payment",
        },
        {
          attempt: 1,
          completedAt: "2026-07-26T10:00:04.000Z",
          phase: "compensation",
          startedAt: "2026-07-26T10:00:03.000Z",
          status: "compensated",
          stepId: "run_checkout_1:reserve-inventory:1",
          stepName: "release-inventory",
        },
      ],
      causationId: WORKFLOW_LIFECYCLE_EVENT_NAMES.stepFailed,
      correlationId: "corr_checkout_1",
      createdAt: "2026-07-26T10:00:00.000Z",
      idempotencyKey: "checkout:cart_1",
      input: { cartId: "cart_1" },
      metadata: { channel: "storefront" },
      nextStepIndex: 2,
      runId: "run_checkout_1",
      schemaVersion: 1,
      status: "compensated",
      subject: {
        id: "cart_1",
        type: "cart",
      },
      updatedAt: "2026-07-26T10:00:04.000Z",
      workflowKey: "checkout.complete",
      workflowVersion: 1,
    });

    expect(decoded.attempts.map((attempt) => attempt.phase)).toEqual([
      "run",
      "run",
      "compensation",
    ]);
    expect(decoded.status).toBe("compensated");
  });
});
