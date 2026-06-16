import type {
  StatefulCoordinationRequest,
  StatefulCoordinationResult,
  StatefulCoordinator,
} from "@ecommerce/core/stateful";

export class InMemoryCartCoordinator implements StatefulCoordinator {
  readonly #results = new Map<string, StatefulCoordinationResult<unknown>>();

  coordinate<Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>> {
    const existing = this.#results.get(request.idempotencyKey);

    if (existing) {
      return Promise.resolve({
        ...existing,
        duplicate: true,
      } as StatefulCoordinationResult<Output>);
    }

    const result: StatefulCoordinationResult<Output> = {
      causationId: request.causationId,
      coordinatedAt: new Date(),
      coordinatorKey: request.coordinatorKey,
      correlationId: request.correlationId,
      duplicate: false,
      idempotencyKey: request.idempotencyKey,
      operationName: request.operationName,
      output: undefined as Output,
      subject: request.subject,
      workflowRunId: request.workflowRunId,
    };

    this.#results.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
}

export const createInMemoryCartCoordinator = (): StatefulCoordinator =>
  new InMemoryCartCoordinator();
