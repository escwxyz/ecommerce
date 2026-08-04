import type { Effect } from "effect/Effect";

export interface CommerceEventEnvelope<
  EventName extends string = string,
  Payload = unknown,
> {
  readonly id: string;
  readonly name: EventName;
  readonly payload: Payload;
  readonly emittedAt: Date;
  readonly sourceModule?: string;
  readonly subject?: {
    readonly type: string;
    readonly id: string;
  };
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly traceId?: string;
  readonly workflowRunId?: string;
}

export type CommerceEventHandler<
  EventName extends string = string,
  Payload = unknown,
  Error = never,
  Requirements = never,
> = (
  event: CommerceEventEnvelope<EventName, Payload>
) => Effect<void, Error, Requirements>;

export interface CommerceEventSubscription<
  EventName extends string = string,
  Payload = unknown,
  Error = never,
  Requirements = never,
> {
  readonly eventName: EventName;
  readonly handler: CommerceEventHandler<
    EventName,
    Payload,
    Error,
    Requirements
  >;
}

export interface CommerceEventPublisher {
  publish<EventName extends string, Payload>(
    event: CommerceEventEnvelope<EventName, Payload>
  ): Promise<void> | void;
}

export const createEventEnvelope = <EventName extends string, Payload>(
  input: Omit<CommerceEventEnvelope<EventName, Payload>, "emittedAt"> & {
    readonly emittedAt?: Date;
  }
): CommerceEventEnvelope<EventName, Payload> => ({
  ...input,
  emittedAt: input.emittedAt ?? new Date(),
});
