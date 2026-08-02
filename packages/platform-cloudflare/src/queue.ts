import type {
  CommerceQueueMessage,
  CommerceQueuePublishOptions,
  CommerceQueuePublishResult,
  CommerceQueuePublisher,
} from "@ecommerce/core";
import { queuePublisherLayer } from "@ecommerce/core";
import { Effect, Schema } from "effect";

export interface CloudflareQueuePublisherOptions {
  readonly queue: Queue<CommerceQueueMessage>;
  readonly clock: {
    now(): Date;
  };
  readonly telemetry?: CloudflareQueueTelemetrySink;
}

export class CloudflareQueuePublishFailure extends Schema.TaggedErrorClass<CloudflareQueuePublishFailure>()(
  "CloudflareQueuePublishFailure",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.NonEmptyString,
    operation: Schema.Literals(["send"]),
    queueName: Schema.NonEmptyString,
  }
) {}

export interface CloudflareQueueTelemetryEvent {
  readonly kind: "queue.publish.failed" | "queue.publish.succeeded";
  readonly messageId: string;
  readonly queueName: string;
  readonly traceId?: string;
  readonly type: string;
  readonly correlationId: string;
  readonly workflowRunId?: string;
}

export interface CloudflareQueueTelemetrySink {
  record(event: CloudflareQueueTelemetryEvent): Promise<void> | void;
}

const toQueuePublishFailure = (message: CommerceQueueMessage, cause: unknown) =>
  new CloudflareQueuePublishFailure({
    cause,
    message: `Failed to publish Cloudflare queue message ${message.id}.`,
    operation: "send",
    queueName: message.queueName,
  });

const recordQueueTelemetry = async (
  telemetry: CloudflareQueueTelemetrySink | undefined,
  event: CloudflareQueueTelemetryEvent
) => {
  try {
    await telemetry?.record(event);
  } catch {
    // Telemetry is observational and must not change queue publish semantics.
  }
};

export const createCloudflareQueuePublisher = ({
  queue,
  clock,
  telemetry,
}: CloudflareQueuePublisherOptions): CommerceQueuePublisher => ({
  publish: async <Payload = unknown>(
    message: CommerceQueueMessage<Payload>,
    options?: CommerceQueuePublishOptions
  ): Promise<CommerceQueuePublishResult> => {
    try {
      await queue.send(message as CommerceQueueMessage, {
        delaySeconds: options?.delaySeconds,
      });
    } catch (error) {
      await recordQueueTelemetry(telemetry, {
        correlationId: message.correlationId,
        kind: "queue.publish.failed",
        messageId: message.id,
        queueName: message.queueName,
        traceId: message.traceId,
        type: message.type,
        workflowRunId: message.workflowRunId,
      });
      throw toQueuePublishFailure(message, error);
    }

    await recordQueueTelemetry(telemetry, {
      correlationId: message.correlationId,
      kind: "queue.publish.succeeded",
      messageId: message.id,
      queueName: message.queueName,
      traceId: message.traceId,
      type: message.type,
      workflowRunId: message.workflowRunId,
    });

    return {
      messageId: message.id,
      queuedAt: clock.now(),
    };
  },
});

/**
 * Exposes the Cloudflare queue publisher as the runtime-neutral Effect service
 * tag while preserving the Promise-shaped queue contract used by existing
 * module adapters.
 */
export const createCloudflareQueuePublisherLayer = (
  options: CloudflareQueuePublisherOptions
) => queuePublisherLayer(createCloudflareQueuePublisher(options));

export const publishCloudflareQueueMessageEffect = <Payload = unknown>(
  publisher: CommerceQueuePublisher,
  message: CommerceQueueMessage<Payload>,
  options?: CommerceQueuePublishOptions
): Effect.Effect<CommerceQueuePublishResult, CloudflareQueuePublishFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof CloudflareQueuePublishFailure
        ? cause
        : toQueuePublishFailure(message, cause),
    try: () => publisher.publish(message, options),
  });
