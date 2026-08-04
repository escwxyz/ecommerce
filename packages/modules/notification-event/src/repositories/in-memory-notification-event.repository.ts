import { Effect, Layer } from "effect";

import type {
  EventDeadLetterRecord,
  EventOutboxRecord,
  NotificationDispatchRecord,
  NotificationEventExpectedError,
  NotificationEventRepository,
  NotificationProviderRecord,
  NotificationTemplate,
} from "../domain";
import { NotificationEventRepositoryService } from "../domain";

export interface ResettableNotificationEventRepository extends NotificationEventRepository {
  readonly clear: Effect.Effect<void>;
}

const cloneDate = (date: Date): Date => new Date(date);

const cloneOutbox = (record: EventOutboxRecord): EventOutboxRecord => ({
  ...record,
  availableAt: cloneDate(record.availableAt),
  createdAt: cloneDate(record.createdAt),
  envelope: {
    ...record.envelope,
    emittedAt: cloneDate(record.envelope.emittedAt),
    payload: record.envelope.payload,
    subject: record.envelope.subject
      ? { ...record.envelope.subject }
      : undefined,
  },
  updatedAt: cloneDate(record.updatedAt),
});

const cloneDeadLetter = (
  record: EventDeadLetterRecord
): EventDeadLetterRecord => ({
  ...record,
  createdAt: cloneDate(record.createdAt),
});

const cloneTemplate = (
  template: NotificationTemplate
): NotificationTemplate => ({
  ...template,
});

const cloneProviderRecord = (
  record: NotificationProviderRecord
): NotificationProviderRecord => ({
  ...record,
  createdAt: cloneDate(record.createdAt),
  updatedAt: cloneDate(record.updatedAt),
});

const cloneDispatch = (
  record: NotificationDispatchRecord
): NotificationDispatchRecord => ({
  ...record,
  createdAt: cloneDate(record.createdAt),
  deliveredAt: record.deliveredAt ? cloneDate(record.deliveredAt) : undefined,
  payload: record.payload,
  recipient: { ...record.recipient },
  updatedAt: cloneDate(record.updatedAt),
});

const sortByCreatedAtDesc = <Record extends { readonly createdAt: Date }>(
  records: Iterable<Record>
): Record[] => {
  const sorted: Record[] = [];

  for (const record of records) {
    const timestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sorted.length) {
      const current = sorted[insertAt];

      if (!current || current.createdAt.getTime() < timestamp) {
        break;
      }

      insertAt += 1;
    }

    sorted.splice(insertAt, 0, record);
  }

  return sorted;
};

export class InMemoryNotificationEventRepository implements ResettableNotificationEventRepository {
  readonly #deadLetters = new Map<string, EventDeadLetterRecord>();
  readonly #dispatches = new Map<string, NotificationDispatchRecord>();
  readonly #dispatchIdempotency = new Map<string, string>();
  readonly #outbox = new Map<string, EventOutboxRecord>();
  readonly #providerRecords = new Map<string, NotificationProviderRecord>();
  readonly #templates = new Map<string, NotificationTemplate>();

  readonly clear = Effect.sync(() => {
    this.#deadLetters.clear();
    this.#dispatches.clear();
    this.#dispatchIdempotency.clear();
    this.#outbox.clear();
    this.#providerRecords.clear();
    this.#templates.clear();
  });

  readonly findDispatchByIdempotencyKey = (
    idempotencyKey: string
  ): Effect.Effect<
    NotificationDispatchRecord | null,
    NotificationEventExpectedError
  > =>
    Effect.sync(() => {
      const id = this.#dispatchIdempotency.get(idempotencyKey);
      const dispatch = id ? this.#dispatches.get(id) : undefined;
      return dispatch ? cloneDispatch(dispatch) : null;
    });

  readonly findOutboxById = (
    outboxId: string
  ): Effect.Effect<EventOutboxRecord | null, NotificationEventExpectedError> =>
    Effect.sync(() => {
      const outbox = this.#outbox.get(outboxId);
      return outbox ? cloneOutbox(outbox) : null;
    });

  readonly findTemplateByKey = ({
    channel,
    templateKey,
  }: {
    readonly channel: NotificationTemplate["channel"];
    readonly templateKey: string;
  }): Effect.Effect<
    NotificationTemplate | null,
    NotificationEventExpectedError
  > =>
    Effect.sync(() => {
      const template = this.#templates.get(`${channel}:${templateKey}`);
      return template ? cloneTemplate(template) : null;
    });

  readonly listDeadLetters: Effect.Effect<
    readonly EventDeadLetterRecord[],
    NotificationEventExpectedError
  > = Effect.sync(() =>
    sortByCreatedAtDesc(this.#deadLetters.values()).map(cloneDeadLetter)
  );

  readonly listDispatches: Effect.Effect<
    readonly NotificationDispatchRecord[],
    NotificationEventExpectedError
  > = Effect.sync(() =>
    sortByCreatedAtDesc(this.#dispatches.values()).map(cloneDispatch)
  );

  readonly saveDeadLetter = (
    record: EventDeadLetterRecord
  ): Effect.Effect<EventDeadLetterRecord, NotificationEventExpectedError> =>
    Effect.sync(() => {
      const cloned = cloneDeadLetter(record);
      this.#deadLetters.set(cloned.id, cloned);
      return cloneDeadLetter(cloned);
    });

  readonly saveDispatch = (
    record: NotificationDispatchRecord
  ): Effect.Effect<
    NotificationDispatchRecord,
    NotificationEventExpectedError
  > =>
    Effect.sync(() => {
      const existingId = this.#dispatchIdempotency.get(record.idempotencyKey);

      if (existingId && existingId !== record.id) {
        const existing = this.#dispatches.get(existingId);
        if (existing) {
          return cloneDispatch(existing);
        }
      }

      const cloned = cloneDispatch(record);
      this.#dispatches.set(cloned.id, cloned);
      this.#dispatchIdempotency.set(cloned.idempotencyKey, cloned.id);
      return cloneDispatch(cloned);
    });

  readonly saveOutbox = (
    record: EventOutboxRecord
  ): Effect.Effect<EventOutboxRecord, NotificationEventExpectedError> =>
    Effect.sync(() => {
      const cloned = cloneOutbox(record);
      this.#outbox.set(cloned.id, cloned);
      return cloneOutbox(cloned);
    });

  readonly saveProviderRecord = (
    record: NotificationProviderRecord
  ): Effect.Effect<
    NotificationProviderRecord,
    NotificationEventExpectedError
  > =>
    Effect.sync(() => {
      const cloned = cloneProviderRecord(record);
      this.#providerRecords.set(cloned.id, cloned);
      return cloneProviderRecord(cloned);
    });

  readonly saveTemplate = (
    template: NotificationTemplate
  ): Effect.Effect<NotificationTemplate, NotificationEventExpectedError> =>
    Effect.sync(() => {
      const cloned = cloneTemplate(template);
      this.#templates.set(`${cloned.channel}:${cloned.templateKey}`, cloned);
      return cloneTemplate(cloned);
    });
}

export const defaultNotificationEventRepository =
  new InMemoryNotificationEventRepository();

export const createInMemoryNotificationEventRepository =
  (): NotificationEventRepository => new InMemoryNotificationEventRepository();

export const createResettableInMemoryNotificationEventRepository =
  (): ResettableNotificationEventRepository =>
    new InMemoryNotificationEventRepository();

export const createNotificationEventRepositoryLayer = (
  repository: NotificationEventRepository
) => Layer.succeed(NotificationEventRepositoryService, repository);
