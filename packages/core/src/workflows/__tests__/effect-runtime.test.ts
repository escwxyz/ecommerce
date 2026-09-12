import { expect, it } from "bun:test";

import { Effect, Fiber, Option, Schema } from "effect";

import {
  createInMemoryWorkflowRecoveryHarness,
  createInMemoryWorkflowRuntime,
  createInMemoryWorkflowStateStore,
  createSequenceIdGenerator,
  createStaticClock,
} from "../../testing/index";
import {
  defineWorkflow,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  WorkflowRuntimeError,
} from "../index";

it("interrupts a fiber without recording failure and resumes completed steps", async () => {
  const harness = createInMemoryWorkflowRecoveryHarness({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    ids: createSequenceIdGenerator(["run", "event"]),
  });
  let first = 0;
  let blocked = true;
  const workflow = defineWorkflow({
    key: "test.recovery",
    version: 1,
    steps: [
      { name: "first", run: () => Effect.sync(() => ({ output: ++first })) },
      {
        name: "wait",
        run: () => (blocked ? Effect.never : Effect.succeed({ output: 2 })),
      },
    ],
  });
  const request = {
    workflow,
    input: {},
    correlationId: "corr",
    idempotencyKey: "key",
  };
  const fiber = Effect.runFork(harness.createRuntime().start(request));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await Effect.runPromise(Fiber.interrupt(fiber));
  expect(harness.state.states.get("run")?.attempts).toHaveLength(1);
  blocked = false;
  const record = await Effect.runPromise(
    harness.createRuntime().start(request)
  );
  expect(record.status).toBe("completed");
  expect(first).toBe(1);
  expect(
    Option.isNone(
      await Effect.runPromise(harness.createRuntime().get("absent"))
    )
  ).toBe(true);
});

it("decodes workflow input and completed output at the runtime boundary", async () => {
  const options = {
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    ids: createSequenceIdGenerator(["schema-run"]),
    publisher: { publish: () => Effect.void },
  };
  const invalidInputWorkflow = defineWorkflow({
    key: "test.schema-input",
    version: 1,
    inputSchema: Schema.Struct({ value: Schema.String }),
    outputSchema: Schema.String,
    steps: [],
    resolveOutput: () => "ok",
  });
  const invalidInput = await Effect.runPromise(
    Effect.flip(
      createInMemoryWorkflowRuntime(options).start({
        workflow: invalidInputWorkflow,
        input: { value: 42 },
        correlationId: "schema-input",
      })
    )
  );
  expect(invalidInput).toBeInstanceOf(WorkflowRuntimeError);
  expect(invalidInput.operation).toBe("validation");

  const invalidOutputWorkflow = defineWorkflow({
    key: "test.schema-output",
    version: 1,
    inputSchema: Schema.Struct({ value: Schema.String }),
    outputSchema: Schema.String,
    steps: [],
    resolveOutput: () => 42,
  });
  const invalidOutput = await Effect.runPromise(
    Effect.flip(
      createInMemoryWorkflowRuntime({
        ...options,
        ids: createSequenceIdGenerator(["schema-output-run"]),
      }).start({
        workflow: invalidOutputWorkflow,
        input: { value: "valid" },
        correlationId: "schema-output",
      })
    )
  );
  expect(invalidOutput).toBeInstanceOf(WorkflowRuntimeError);
  expect(invalidOutput.operation).toBe("validation");
});

it("replays a persisted lifecycle checkpoint with a stable event id", async () => {
  const state = createInMemoryWorkflowStateStore();
  const clock = createStaticClock(new Date("2026-01-01T00:00:00.000Z"));
  let stepCalls = 0;
  let failedEventId: string | undefined;
  const workflow = defineWorkflow({
    key: "test.lifecycle-replay",
    version: 1,
    steps: [
      {
        name: "checkpoint",
        run: () =>
          Effect.sync(() => {
            stepCalls += 1;
            return { output: "done" };
          }),
      },
    ],
    resolveOutput: () => "done",
  });
  const request = {
    workflow,
    input: {},
    correlationId: "lifecycle-replay",
    idempotencyKey: "lifecycle-replay",
  };
  const firstRuntime = createInMemoryWorkflowRuntime({
    clock,
    ids: createSequenceIdGenerator(["lifecycle-run"]),
    stateStore: state.store,
    publisher: {
      publish: (event) => {
        if (event.name === WORKFLOW_LIFECYCLE_EVENT_NAMES.stepSucceeded) {
          failedEventId = event.id;
          return Effect.fail(
            new WorkflowRuntimeError({
              operation: "event",
              message: "publisher unavailable",
            })
          );
        }
        return Effect.void;
      },
    },
  });
  await expect(
    Effect.runPromise(firstRuntime.start(request))
  ).rejects.toThrow();

  const replayedIds: string[] = [];
  const recovered = await Effect.runPromise(
    createInMemoryWorkflowRuntime({
      clock,
      ids: createSequenceIdGenerator([]),
      stateStore: state.store,
      publisher: {
        publish: (event) =>
          Effect.sync(() => {
            replayedIds.push(event.id);
          }),
      },
    }).start(request)
  );
  expect(recovered.status).toBe("completed");
  expect(stepCalls).toBe(1);
  if (!failedEventId) {
    throw new Error("Expected the failed lifecycle publication to be captured");
  }
  expect(replayedIds).toContain(failedEventId);
});
