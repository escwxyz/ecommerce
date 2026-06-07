export interface StatefulCoordinationSubject {
  readonly type: string;
  readonly id: string;
}

export interface StatefulCoordinationMetadata {
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly causationId?: string;
  readonly subject?: StatefulCoordinationSubject;
  readonly workflowRunId?: string;
}

export interface StatefulCoordinationRequest<
  Input = unknown,
> extends StatefulCoordinationMetadata {
  readonly coordinatorKey: string;
  readonly operationName: string;
  readonly payload: Input;
}

export interface StatefulCoordinationResult<
  Output = unknown,
> extends StatefulCoordinationMetadata {
  readonly coordinatorKey: string;
  readonly operationName: string;
  readonly output: Output;
  readonly duplicate: boolean;
  readonly coordinatedAt: Date;
}

export interface StatefulCoordinator {
  coordinate<Input = unknown, Output = unknown>(
    request: StatefulCoordinationRequest<Input>
  ): Promise<StatefulCoordinationResult<Output>>;
}

export const defineStatefulCoordinationRequest = <Input = unknown>(
  request: StatefulCoordinationRequest<Input>
): StatefulCoordinationRequest<Input> => request;
