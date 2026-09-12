import { Effect, Option } from "effect";

import { WorkflowRuntimeService } from "../services/index";
import { defineWorkflow } from "../workflows/index";

/** One portable behavior executed through the canonical runtime service. */
export interface WorkflowRuntimeContractCase {
  readonly name: string;
  readonly run: Effect.Effect<void, unknown, WorkflowRuntimeService>;
}

const verify = (condition: boolean, message: string) =>
  condition ? Effect.void : Effect.fail(new Error(message));

/**
 * Shared contract cases for local execution and remote dispatch adapters.
 * Each case needs a fresh Layer. Platform fixtures may settle dispatched work
 * before reconciliation; all observations still use WorkflowRuntimeService.
 */
export const workflowRuntimeContractCases = (
  settle: (
    runId: string,
    status?: "completed" | "failed"
  ) => Effect.Effect<void, unknown> = () => Effect.void
): readonly WorkflowRuntimeContractCase[] => {
  const workflow = defineWorkflow({
    key: "contract.workflow",
    version: 1,
    schemaVersion: 1,
    steps: [
      {
        name: "produce-result",
        run: (input: { value: string }) =>
          Effect.succeed({ output: input.value }),
      },
    ],
    resolveOutput: () => "contract-output",
  });
  const request = {
    workflow,
    input: { value: "contract-input" },
    correlationId: "contract-correlation",
    causationId: "contract-causation",
    traceId: "contract-trace",
    subject: { id: "cart-contract", type: "cart" },
    idempotencyKey: "contract-idempotency",
    runId: "contract-run",
  };
  const failedWorkflow = defineWorkflow({
    key: "contract.failed-workflow",
    version: 1,
    schemaVersion: 1,
    steps: [
      {
        name: "reject",
        run: () => Effect.fail(new Error("contract rejection")),
      },
    ],
  });

  return [
    {
      name: "missing lookups succeed with explicit absence",
      run: Effect.gen(function* run() {
        const runtime = yield* WorkflowRuntimeService;
        const missing = yield* runtime.get("missing-run");
        const duplicate = yield* runtime.dedupe({
          workflowKey: workflow.key,
          idempotencyKey: "missing-key",
        });
        const reconciled = yield* runtime.reconcile({ runId: "missing-run" });
        yield* verify(
          Option.isNone(missing) &&
            Option.isNone(duplicate) &&
            Option.isNone(reconciled),
          "Missing workflow lookups must succeed with Option.none"
        );
      }),
    },
    {
      name: "start preserves input and causal identity across lookup",
      run: Effect.gen(function* run() {
        const runtime = yield* WorkflowRuntimeService;
        const started = yield* runtime.start(request);
        const found = yield* runtime.get(started.runId);
        if (Option.isNone(found)) {
          return yield* Effect.fail(new Error("Started run was not found"));
        }
        yield* verify(
          found.value.runId === request.runId &&
            found.value.workflowKey === workflow.key &&
            found.value.workflowVersion === 1 &&
            found.value.correlationId === request.correlationId &&
            found.value.causationId === request.causationId &&
            found.value.traceId === request.traceId &&
            found.value.subject?.id === request.subject.id &&
            JSON.stringify(found.value.input) === JSON.stringify(request.input),
          "Workflow lookup must preserve input, version, and causal identity"
        );
        yield* verify(
          typeof runtime.capabilities.adapter === "string" &&
            typeof runtime.capabilities.supportsCompensation === "boolean",
          "Runtime capabilities must remain descriptive data"
        );
      }),
    },
    {
      name: "concurrent duplicate starts converge on one registered run",
      run: Effect.gen(function* run() {
        const runtime = yield* WorkflowRuntimeService;
        const runs = yield* Effect.all(
          ["candidate-a", "candidate-b", "candidate-c"].map((runId) =>
            runtime.start({ ...request, runId })
          ),
          { concurrency: "unbounded" }
        );
        const runIds = new Set(runs.map((record) => record.runId));
        const duplicate = yield* runtime.dedupe({
          workflowKey: workflow.key,
          idempotencyKey: request.idempotencyKey,
        });
        yield* verify(
          runIds.size === 1 &&
            Option.isSome(duplicate) &&
            runIds.has(duplicate.value.runId),
          "Concurrent idempotent starts must converge on one logical run"
        );
      }),
    },
    {
      name: "reconciliation exposes completed output without losing identity",
      run: Effect.gen(function* run() {
        const runtime = yield* WorkflowRuntimeService;
        const started = yield* runtime.start(request);
        yield* settle(started.runId);
        const reconciled = yield* runtime.reconcile<string>({
          runId: started.runId,
        });
        yield* verify(
          Option.isSome(reconciled) &&
            reconciled.value.status === "completed" &&
            reconciled.value.output === "contract-output" &&
            reconciled.value.correlationId === request.correlationId &&
            reconciled.value.runId === started.runId,
          "Reconciliation must expose completed output with stable identity"
        );
      }),
    },
    {
      name: "reconciliation exposes failed output without fabricating success",
      run: Effect.gen(function* run() {
        const runtime = yield* WorkflowRuntimeService;
        const started = yield* runtime.start({
          ...request,
          workflow: failedWorkflow,
          runId: "contract-failed-run",
          idempotencyKey: "contract-failed-idempotency",
        });
        yield* settle(started.runId, "failed");
        const reconciled = yield* runtime.reconcile({ runId: started.runId });
        yield* verify(
          Option.isSome(reconciled) &&
            reconciled.value.status === "failed" &&
            reconciled.value.output === undefined &&
            reconciled.value.runId === started.runId,
          "Reconciliation must expose failed status without a success output"
        );
      }),
    },
  ];
};
