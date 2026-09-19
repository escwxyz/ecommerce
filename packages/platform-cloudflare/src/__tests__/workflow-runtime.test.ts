import { describe, expect, it } from "bun:test";

import {
  createInMemoryWorkflowMetadataStore,
  createInMemoryWorkflowStateStore,
  defineWorkflow,
  WORKFLOW_LIFECYCLE_EVENT_NAMES,
  WorkflowRuntimeError,
  WorkflowRuntimeService,
} from "@ecommerce/core";
import { workflowRuntimeContractCases } from "@ecommerce/core/testing";
import { Cause, Effect, Exit, Fiber, Option, Schema } from "effect";

import { createCloudflareWorkflowRuntimeLayer } from "../workflows/runtime";
import type {
  CloudflareWorkflowRuntimeBindings,
  CloudflareWorkflowRuntimeOptions,
} from "../workflows/runtime";

const fixture = (overrides: Partial<CloudflareWorkflowRuntimeOptions> = {}) => {
  const statuses = new Map<string, InstanceStatus>();
  const state = createInMemoryWorkflowStateStore();
  let id = 0;
  const options: CloudflareWorkflowRuntimeOptions = {
    bindings: {
      workflow: {
        create: async ({ id: runId }: { id: string }) => {
          statuses.set(runId, { status: "queued" });
          return { id: runId };
        },
        get: async (runId: string) => ({
          status: async () => statuses.get(runId),
        }),
      } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
    },
    clock: { now: () => new Date("2026-06-06T14:30:00.000Z") },
    ids: { nextId: () => `cf-${++id}` },
    publisher: { publish: () => Effect.void },
    stateStore: state.store,
    ...overrides,
  };
  return {
    options,
    state,
    statuses,
    layer: createCloudflareWorkflowRuntimeLayer(options),
  };
};
const request = {
  workflow: defineWorkflow({ key: "cf.test", version: 1, steps: [] }),
  input: {},
  correlationId: "cf-correlation",
  runId: "cf-run",
};

describe("Cloudflare Effect workflow conformance", () => {
  const names = workflowRuntimeContractCases();
  for (const [index, contract] of names.entries()) {
    it(contract.name, async () => {
      const { layer, statuses } = fixture();
      const cases = workflowRuntimeContractCases((runId, status) =>
        Effect.sync(() => {
          statuses.set(
            runId,
            status === "failed"
              ? {
                  status: "errored",
                  error: { name: "ContractFailure", message: "rejected" },
                }
              : { status: "complete", output: "contract-output" }
          );
        })
      );
      await Effect.runPromise(cases[index]!.run.pipe(Effect.provide(layer)));
    });
  }

  it("keeps platform rejections typed and excludes raw exception details", async () => {
    const { options } = fixture();
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      bindings: {
        workflow: {
          create: async () => {
            throw new Error("secret-binding-token");
          },
        } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
      },
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        return yield* Effect.exit(runtime.start(request));
      }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      expect(Cause.hasFails(result.cause)).toBe(true);
      expect(JSON.stringify(result)).not.toContain("secret-binding-token");
    }
  });

  it("preserves durable state when telemetry export fails", async () => {
    const { layer } = fixture({
      telemetry: { record: () => Effect.fail("exporter unavailable") },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const started = yield* runtime.start(request);
        const found = yield* runtime.get(started.runId);
        expect(Option.getOrThrow(found).status).toBe("pending");
      }).pipe(Effect.provide(layer))
    );
  });

  it("preserves store defects instead of classifying them as expected failures", async () => {
    const { options, state } = fixture();
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      stateStore: {
        ...state.store,
        getRunState: () => Effect.die("store-defect"),
      },
    });
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        return yield* Effect.exit(runtime.get("cf-run"));
      }).pipe(Effect.provide(layer))
    );
    expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
  });

  it("aborts coordinator fetch on interruption and leaves resumable registration", async () => {
    let signal: AbortSignal | undefined;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const { options, state } = fixture();
    const coordinator = {
      getByName: () => ({
        fetch: (input: Request) => {
          signal = input.signal;
          started();
          return new Promise<Response>(() => {});
        },
      }),
    } as unknown as DurableObjectNamespace;
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      bindings: { ...options.bindings, coordinator },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const fiber = yield* Effect.forkChild(runtime.start(request));
        yield* Effect.promise(() => ready);
        yield* Fiber.interrupt(fiber);
        const durable = yield* state.store.getRunState("cf-run");
        expect(Option.getOrThrow(durable).status).toBe("pending");
        expect(Option.getOrThrow(durable).attempts).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer))
    );
    expect(signal?.aborted).toBe(true);
  });

  it("uses advanced durable state before local or metadata projections", async () => {
    const { layer, state, statuses } = fixture();
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        yield* runtime.start(request);
        const saved = Option.getOrThrow(
          yield* state.store.getRunState("cf-run")
        );
        yield* state.store.upsertRunState({
          ...saved,
          status: "completed",
          output: "durable-output",
        });
        statuses.set("cf-run", { status: "running" });
        const found = Option.getOrThrow(
          yield* runtime.reconcile({ runId: "cf-run" })
        );
        expect(found.status).toBe("completed");
        expect(found.output).toBe("durable-output");
      }).pipe(Effect.provide(layer))
    );
  });

  it("resumes queue dispatch without recreating a registered workflow", async () => {
    let createCalls = 0;
    let queueCalls = 0;
    const { options, state } = fixture();
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      bindings: {
        workflow: {
          create: async ({ id }: { id: string }) => {
            createCalls += 1;
            return { id };
          },
        } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
        dispatchQueue: {
          send: async () => {
            queueCalls += 1;
            if (queueCalls === 1) {
              throw new Error("queue unavailable");
            }
          },
        } as unknown as Queue<never>,
      },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const first = yield* Effect.exit(runtime.start(request));
        expect(Exit.isFailure(first)).toBe(true);
        expect(
          Option.getOrThrow(yield* state.store.getRunState("cf-run"))
            .dispatchStatus
        ).toBe("workflow-created");
        const resumed = yield* runtime.start(request);
        expect(resumed.dispatchStatus).toBe("coordinated");
      }).pipe(Effect.provide(layer))
    );
    expect(createCalls).toBe(1);
    expect(queueCalls).toBe(2);
  });

  it("reconciles a create accepted before its checkpoint was interrupted", async () => {
    const { options, state } = fixture();
    const instances = new Set<string>();
    let createCalls = 0;
    let getCalls = 0;
    let batchCalls = 0;
    let interruptCheckpoint = true;
    const recoveryOptions: CloudflareWorkflowRuntimeOptions = {
      ...options,
      bindings: {
        workflow: {
          create: async ({ id }: { id: string }) => {
            createCalls += 1;
            instances.add(id);
            return { id };
          },
          get: async (id: string) => {
            getCalls += 1;
            if (!instances.has(id)) {
              throw new Error("Instance not found.");
            }
            return { id, status: async () => ({ status: "queued" }) };
          },
          createBatch: async () => {
            batchCalls += 1;
            return [];
          },
        } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
      },
      stateStore: {
        ...state.store,
        upsertRunState: (runState) => {
          if (
            interruptCheckpoint &&
            runState.dispatchStatus === "workflow-created"
          ) {
            interruptCheckpoint = false;
            return Effect.interrupt;
          }
          return state.store.upsertRunState(runState);
        },
      },
    };
    const idempotentRequest = { ...request, idempotencyKey: "accepted-create" };
    const first = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        return yield* Effect.exit(runtime.start(idempotentRequest));
      }).pipe(
        Effect.provide(createCloudflareWorkflowRuntimeLayer(recoveryOptions))
      )
    );
    expect(Exit.isFailure(first)).toBe(true);
    expect(
      Option.getOrThrow(
        await Effect.runPromise(state.store.getRunState("cf-run"))
      ).dispatchStatus
    ).toBe("registered");

    const resumed = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        return yield* runtime.start(idempotentRequest);
      }).pipe(
        Effect.provide(createCloudflareWorkflowRuntimeLayer(recoveryOptions))
      )
    );
    expect(resumed.dispatchStatus).toBe("coordinated");
    expect(createCalls).toBe(1);
    expect(getCalls).toBe(1);
    expect(batchCalls).toBe(0);
  });

  it("retries an absent registered instance with idempotent batch creation", async () => {
    const { options, state } = fixture();
    let createCalls = 0;
    let batchCalls = 0;
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      bindings: {
        workflow: {
          create: async () => {
            createCalls += 1;
            throw new Error("Create rejected before acceptance.");
          },
          get: async () => {
            throw new Error("Instance not found.");
          },
          createBatch: async ([{ id }]: [{ id: string }]) => {
            batchCalls += 1;
            return [{ id }];
          },
        } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
      },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const idempotentRequest = {
          ...request,
          idempotencyKey: "retry-create",
        };
        expect(
          Exit.isFailure(yield* Effect.exit(runtime.start(idempotentRequest)))
        ).toBe(true);
        expect(
          Option.getOrThrow(yield* state.store.getRunState("cf-run"))
            .dispatchStatus
        ).toBe("registered");
        const resumed = yield* runtime.start(idempotentRequest);
        expect(resumed.dispatchStatus).toBe("coordinated");
      }).pipe(Effect.provide(layer))
    );
    expect(createCalls).toBe(1);
    expect(batchCalls).toBe(1);
  });

  it("keeps workflow and schema versions distinct in platform payloads", async () => {
    let payload: unknown;
    const { options } = fixture();
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      bindings: {
        workflow: {
          create: async ({ id, params }: { id: string; params: unknown }) => {
            payload = params;
            return { id };
          },
        } as unknown as CloudflareWorkflowRuntimeBindings["workflow"],
      },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const started = yield* runtime.start({
          ...request,
          workflow: defineWorkflow({
            key: "cf.test",
            version: 7,
            schemaVersion: 3,
            steps: [],
          }),
        });
        expect(started.workflowVersion).toBe(7);
        expect(started.schemaVersion).toBe(3);
      }).pipe(Effect.provide(layer))
    );
    expect(payload).toMatchObject({ workflowVersion: 7, schemaVersion: 3 });
  });

  it("rejects malformed completed output before it becomes durable state", async () => {
    const { options, state, statuses } = fixture();
    const strictRequest = {
      ...request,
      workflow: defineWorkflow({
        key: "cf.test",
        version: 1,
        inputSchema: Schema.Struct({}),
        outputSchema: Schema.String,
        steps: [],
      }),
    };
    const layer = createCloudflareWorkflowRuntimeLayer(options);
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        yield* runtime.start(strictRequest);
        statuses.set("cf-run", { status: "complete", output: 42 });
        const result = yield* Effect.exit(
          runtime.reconcile({ runId: "cf-run" })
        );
        expect(Exit.isFailure(result)).toBe(true);
        expect(
          Option.getOrThrow(yield* state.store.getRunState("cf-run")).status
        ).toBe("pending");
      }).pipe(Effect.provide(layer))
    );
  });

  it("replays a terminal lifecycle event after publication failure", async () => {
    const publishedIds: string[] = [];
    let rejectedId: string | undefined;
    let rejectCompleted = true;
    const { options, statuses } = fixture();
    const layer = createCloudflareWorkflowRuntimeLayer({
      ...options,
      publisher: {
        publish: (event) => {
          if (
            event.name === WORKFLOW_LIFECYCLE_EVENT_NAMES.completed &&
            rejectCompleted
          ) {
            rejectCompleted = false;
            rejectedId = event.id;
            return Effect.fail(
              new WorkflowRuntimeError({
                operation: "event",
                message: "publisher unavailable",
              })
            );
          }
          return Effect.sync(() => {
            publishedIds.push(event.id);
          });
        },
      },
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        yield* runtime.start(request);
        statuses.set("cf-run", {
          status: "complete",
          output: "contract-output",
        });
        expect(
          Exit.isFailure(
            yield* Effect.exit(runtime.reconcile({ runId: "cf-run" }))
          )
        ).toBe(true);
        const recovered = Option.getOrThrow(
          yield* runtime.reconcile({ runId: "cf-run" })
        );
        expect(recovered.status).toBe("completed");
      }).pipe(Effect.provide(layer))
    );
    if (!rejectedId) {
      throw new Error("Expected completed publication to fail once");
    }
    expect(publishedIds).toContain(rejectedId);
  });

  it("refuses to reconstruct replay state from a metadata projection", async () => {
    const metadata = createInMemoryWorkflowMetadataStore();
    const { options, state, statuses } = fixture({
      metadataStore: metadata.store,
    });
    const runId = "projection-run";
    const workflow = defineWorkflow({
      key: "projection.workflow",
      version: 1,
      inputSchema: Schema.Struct({ cartId: Schema.String }),
      outputSchema: Schema.String,
      steps: [],
    });
    await Effect.runPromise(
      metadata.store.upsertRun({
        runId,
        workflowKey: workflow.key,
        workflowVersion: workflow.version,
        schemaVersion: 1,
        status: "completed",
        correlationId: "projection-correlation",
        idempotencyKey: "projection-key",
        updatedAt: new Date("2026-06-06T14:30:00.000Z"),
      })
    );
    statuses.set(runId, { status: "complete", output: 42 });

    await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* WorkflowRuntimeService;
        const failures = yield* Effect.all([
          Effect.flip(runtime.get(runId)),
          Effect.flip(
            runtime.dedupe({
              workflowKey: workflow.key,
              idempotencyKey: "projection-key",
            })
          ),
          Effect.flip(runtime.reconcile({ runId })),
          Effect.flip(
            runtime.start({
              workflow,
              input: { cartId: "cart-1" },
              correlationId: "projection-correlation",
              idempotencyKey: "projection-key",
            })
          ),
        ]);
        expect(failures.map((failure) => failure.operation)).toEqual([
          "state",
          "state",
          "state",
          "state",
        ]);
        expect(Option.isNone(yield* state.store.getRunState(runId))).toBe(true);
      }).pipe(Effect.provide(createCloudflareWorkflowRuntimeLayer(options)))
    );
  });
});
