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
  CommerceWorkflowKeySchema,
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

it("replays decoded durable input into steps and compensators", async () => {
  const state = createInMemoryWorkflowStateStore();
  const timestamp = "2026-01-02T03:04:05.000Z";
  await Effect.runPromise(
    state.store.upsertRunState({
      attempts: [],
      correlationId: "decoded-replay",
      createdAt: timestamp,
      idempotencyKey: "decoded-replay",
      input: { scheduledAt: timestamp },
      nextStepIndex: 0,
      runId: "decoded-replay-run",
      schemaVersion: 1,
      status: "running",
      updatedAt: timestamp,
      workflowKey: Schema.decodeUnknownSync(CommerceWorkflowKeySchema)(
        "test.decoded-replay"
      ),
      workflowVersion: 1,
    })
  );
  const observed: Date[] = [];
  const workflow = defineWorkflow({
    key: "test.decoded-replay",
    version: 1,
    inputSchema: Schema.Struct({ scheduledAt: Schema.DateFromString }),
    steps: [
      {
        name: "first",
        run: (input: { scheduledAt: Date }) => {
          observed.push(input.scheduledAt);
          return Effect.succeed({ output: "reserved" });
        },
        compensation: {
          name: "undo-first",
          compensate: (input: { scheduledAt: Date }) =>
            Effect.sync(() => {
              observed.push(input.scheduledAt);
            }),
        },
      },
      { name: "second", run: () => Effect.fail(new Error("rejected")) },
    ],
  });
  const result = await Effect.runPromise(
    createInMemoryWorkflowRuntime({
      clock: createStaticClock(new Date(timestamp)),
      ids: createSequenceIdGenerator([]),
      publisher: { publish: () => Effect.void },
      stateStore: state.store,
    }).start({
      workflow,
      input: { scheduledAt: new Date(timestamp) },
      correlationId: "decoded-replay",
      idempotencyKey: "decoded-replay",
    })
  );
  expect(result.status).toBe("compensated");
  expect(observed).toHaveLength(2);
  for (const date of observed) {
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe(timestamp);
  }
  expect(result.input.scheduledAt).toBeInstanceOf(Date);
});

it("returns decoded terminal output from durable replay", async () => {
  const state = createInMemoryWorkflowStateStore();
  const timestamp = "2026-01-02T03:04:05.000Z";
  await Effect.runPromise(
    state.store.upsertRunState({
      attempts: [],
      completedAt: timestamp,
      correlationId: "decoded-terminal",
      createdAt: timestamp,
      idempotencyKey: "decoded-terminal",
      input: { scheduledAt: timestamp },
      nextStepIndex: 0,
      output: timestamp,
      runId: "decoded-terminal-run",
      schemaVersion: 1,
      status: "completed",
      updatedAt: timestamp,
      workflowKey: Schema.decodeUnknownSync(CommerceWorkflowKeySchema)(
        "test.decoded-terminal"
      ),
      workflowVersion: 1,
    })
  );
  const workflow = defineWorkflow({
    key: "test.decoded-terminal",
    version: 1,
    inputSchema: Schema.Struct({ scheduledAt: Schema.DateFromString }),
    outputSchema: Schema.DateFromString,
    steps: [],
  });
  const result = await Effect.runPromise(
    createInMemoryWorkflowRuntime({
      clock: createStaticClock(new Date(timestamp)),
      ids: createSequenceIdGenerator([]),
      publisher: { publish: () => Effect.void },
      stateStore: state.store,
    }).start({
      workflow,
      input: { scheduledAt: new Date(timestamp) },
      correlationId: "decoded-terminal",
      idempotencyKey: "decoded-terminal",
    })
  );
  expect(result.output).toBeInstanceOf(Date);
  expect((result.output as Date).toISOString()).toBe(timestamp);
});

it("stores transformed request input in its encoded durable form", async () => {
  const state = createInMemoryWorkflowStateStore();
  const timestamp = "2026-01-02T03:04:05.000Z";
  let stepInput: unknown;
  const workflow = defineWorkflow({
    key: "test.encoded-input",
    version: 1,
    inputSchema: Schema.Struct({ scheduledAt: Schema.DateFromString }),
    outputSchema: Schema.DateFromString,
    steps: [
      {
        name: "schedule",
        run: (input: { scheduledAt: Date }) => {
          stepInput = input.scheduledAt;
          return Effect.succeed({ output: "scheduled" });
        },
      },
    ],
    resolveOutput: () => timestamp,
  });
  const runtime = createInMemoryWorkflowRuntime({
    clock: createStaticClock(new Date(timestamp)),
    ids: createSequenceIdGenerator([]),
    publisher: { publish: () => Effect.void },
    stateStore: state.store,
  });
  const request = {
    workflow,
    input: { scheduledAt: new Date(timestamp) },
    correlationId: "encoded-input",
    runId: "encoded-input-run",
  };
  const started = await Effect.runPromise(runtime.start(request));
  expect(stepInput).toBeInstanceOf(Date);
  expect(state.states.get(started.runId)?.input).toEqual({
    scheduledAt: timestamp,
  });
  expect(state.states.get(started.runId)?.output).toBe(timestamp);
  expect(started.output).toBeInstanceOf(Date);
  const replayed = await Effect.runPromise(runtime.start(request));
  expect(replayed.input.scheduledAt).toBeInstanceOf(Date);
  expect(replayed.output).toBeInstanceOf(Date);
});

it("skips output resolution after a terminal step failure", async () => {
  const harness = createInMemoryWorkflowRecoveryHarness({
    clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
    ids: createSequenceIdGenerator(["failed-run"]),
  });
  let resolverCalls = 0;
  let compensationCalls = 0;
  const workflow = defineWorkflow({
    key: "test.failed-output-resolution",
    version: 1,
    outputSchema: Schema.String,
    steps: [
      {
        name: "reserve",
        run: () => Effect.succeed({ output: "reserved" }),
        compensation: {
          name: "release",
          compensate: () =>
            Effect.sync(() => {
              compensationCalls += 1;
            }),
        },
      },
      { name: "checkout", run: () => Effect.fail(new Error("rejected")) },
    ],
    resolveOutput: () => {
      resolverCalls += 1;
      throw new Error("No completed checkout attempt");
    },
  });

  const result = await Effect.runPromise(
    harness.createRuntime().start({
      workflow,
      input: {},
      correlationId: "failed-output-resolution",
    })
  );

  expect(result.status).toBe("compensated");
  expect(resolverCalls).toBe(0);
  expect(compensationCalls).toBe(1);
  expect(harness.state.states.get(result.runId)?.status).toBe("compensated");
  expect(
    harness.events.some(
      (event) => event.name === WORKFLOW_LIFECYCLE_EVENT_NAMES.failed
    )
  ).toBe(true);
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
