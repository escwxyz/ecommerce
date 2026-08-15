import type { CommerceQueueMessage } from "@ecommerce/core";
import type { NotificationEventQueueMessage } from "@ecommerce/platform-cloudflare";

export type CommerceServerQueueMessage =
  | CommerceQueueMessage
  | NotificationEventQueueMessage;

export interface CommerceServerQueueProcessors {
  readonly processCommerceEventQueue: (
    batch: MessageBatch<unknown>
  ) => Promise<void>;
  readonly processNotificationEventQueue: (
    batch: MessageBatch<NotificationEventQueueMessage>
  ) => Promise<void>;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isNotificationEventQueueMessage = (
  message: unknown
): message is NotificationEventQueueMessage =>
  isObjectRecord(message) && "kind" in message;

const hasNotificationEventBody = (
  message: Message<unknown>
): message is Message<NotificationEventQueueMessage> =>
  isNotificationEventQueueMessage(message.body);

const withMessages = <MessageBody>(
  batch: MessageBatch<unknown>,
  messages: readonly Message<MessageBody>[]
): MessageBatch<MessageBody> => ({
  ...batch,
  messages: [...messages],
});

export const routeCommerceServerQueueBatch = async (
  batch: MessageBatch<unknown>,
  processors: CommerceServerQueueProcessors
): Promise<void> => {
  const commerceMessages: Message<unknown>[] = [];
  const notificationMessages: Message<NotificationEventQueueMessage>[] = [];

  for (const message of batch.messages) {
    if (hasNotificationEventBody(message)) {
      notificationMessages.push(message);
    } else {
      commerceMessages.push(message);
    }
  }

  await Promise.all([
    commerceMessages.length > 0
      ? processors.processCommerceEventQueue(
          withMessages(batch, commerceMessages)
        )
      : Promise.resolve(),
    notificationMessages.length > 0
      ? processors.processNotificationEventQueue(
          withMessages(batch, notificationMessages)
        )
      : Promise.resolve(),
  ]);
};
