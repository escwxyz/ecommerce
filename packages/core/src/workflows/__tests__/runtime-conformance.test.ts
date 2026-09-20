import { describe, it } from "bun:test";

import { Effect } from "effect";

import { workflowRuntimeLayer } from "../../services/index";
import {
  createInMemoryWorkflowRuntime,
  createInMemoryWorkflowStateStore,
  createSequenceIdGenerator,
  createStaticClock,
} from "../../testing/index";
import { workflowRuntimeContractCases } from "../../testing/workflow-contracts";

describe("deterministic WorkflowRuntimeService conformance", () => {
  for (const contract of workflowRuntimeContractCases()) {
    it(contract.name, async () => {
      const runtime = createInMemoryWorkflowRuntime({
        clock: createStaticClock(new Date("2026-01-01T00:00:00.000Z")),
        ids: createSequenceIdGenerator(["contract-event"]),
        publisher: { publish: () => Effect.void },
        stateStore: createInMemoryWorkflowStateStore().store,
      });
      await Effect.runPromise(
        contract.run.pipe(Effect.provide(workflowRuntimeLayer(runtime)))
      );
    });
  }
});
