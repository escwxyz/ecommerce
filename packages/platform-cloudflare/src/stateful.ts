import type {
  StatefulCoordinationRequest,
  StatefulCoordinationResult,
  StatefulCoordinator,
} from "@ecommerce/core";

export interface CloudflareStatefulCoordinatorOptions {
  readonly namespace: DurableObjectNamespace;
  readonly clock: {
    now(): Date;
  };
}

export const createCloudflareStatefulCoordinator = ({
  namespace,
  clock,
}: CloudflareStatefulCoordinatorOptions): StatefulCoordinator => ({
  coordinate: async <Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>> => {
    const stub = namespace.getByName(request.coordinatorKey);
    const response = await stub.fetch(
      new Request("https://stateful-coordinator.internal/coordinate", {
        body: JSON.stringify(request),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    if (!response.ok) {
      throw new Error(
        `Stateful coordinator "${request.coordinatorKey}" rejected "${request.operationName}" with ${response.status}.`
      );
    }

    const result = (await response.json()) as Partial<
      StatefulCoordinationResult<Output>
    >;

    return {
      causationId: request.causationId,
      coordinatedAt: clock.now(),
      coordinatorKey: request.coordinatorKey,
      correlationId: request.correlationId,
      duplicate: result.duplicate ?? false,
      idempotencyKey: request.idempotencyKey,
      operationName: request.operationName,
      output: result.output as Output,
      subject: request.subject,
      workflowRunId: request.workflowRunId,
    };
  },
});
