import type {
  CommerceQueueMessage,
  CommerceQueuePublishOptions,
  CommerceQueuePublishResult,
  CommerceQueuePublisher,
} from "@ecommerce/core";

export interface CloudflareQueuePublisherOptions {
  readonly queue: Queue<CommerceQueueMessage>;
  readonly clock: {
    now(): Date;
  };
}

export const createCloudflareQueuePublisher = ({
  queue,
  clock,
}: CloudflareQueuePublisherOptions): CommerceQueuePublisher => ({
  publish: async <Payload = unknown>(
    message: CommerceQueueMessage<Payload>,
    options?: CommerceQueuePublishOptions
  ): Promise<CommerceQueuePublishResult> => {
    await queue.send(message as CommerceQueueMessage, {
      delaySeconds: options?.delaySeconds,
    });

    return {
      messageId: message.id,
      queuedAt: clock.now(),
    };
  },
});
