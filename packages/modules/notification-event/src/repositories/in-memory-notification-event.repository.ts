import type {
  EventDeadLetterRecord,
  EventOutboxRecord,
  NotificationDispatchRecord,
  NotificationEventRepository,
  NotificationProviderRecord,
  NotificationTemplate,
} from "../domain";

export interface ResettableNotificationEventRepository extends NotificationEventRepository {
  clear(): void;
}

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

  clear(): void {
    this.#deadLetters.clear();
    this.#dispatches.clear();
    this.#dispatchIdempotency.clear();
    this.#outbox.clear();
    this.#providerRecords.clear();
    this.#templates.clear();
  }

  findDispatchByIdempotencyKey(
    idempotencyKey: string
  ): Promise<NotificationDispatchRecord | null> {
    const id = this.#dispatchIdempotency.get(idempotencyKey);
    return Promise.resolve(id ? (this.#dispatches.get(id) ?? null) : null);
  }

  findOutboxById(outboxId: string): Promise<EventOutboxRecord | null> {
    return Promise.resolve(this.#outbox.get(outboxId) ?? null);
  }

  findTemplateByKey({
    channel,
    templateKey,
  }: {
    readonly channel: NotificationTemplate["channel"];
    readonly templateKey: string;
  }): Promise<NotificationTemplate | null> {
    return Promise.resolve(
      this.#templates.get(`${channel}:${templateKey}`) ?? null
    );
  }

  listDeadLetters(): Promise<readonly EventDeadLetterRecord[]> {
    return Promise.resolve(sortByCreatedAtDesc(this.#deadLetters.values()));
  }

  listDispatches(): Promise<readonly NotificationDispatchRecord[]> {
    return Promise.resolve(sortByCreatedAtDesc(this.#dispatches.values()));
  }

  saveDeadLetter(
    record: EventDeadLetterRecord
  ): Promise<EventDeadLetterRecord> {
    this.#deadLetters.set(record.id, record);
    return Promise.resolve(record);
  }

  saveDispatch(
    record: NotificationDispatchRecord
  ): Promise<NotificationDispatchRecord> {
    this.#dispatches.set(record.id, record);
    this.#dispatchIdempotency.set(record.idempotencyKey, record.id);
    return Promise.resolve(record);
  }

  saveOutbox(record: EventOutboxRecord): Promise<EventOutboxRecord> {
    this.#outbox.set(record.id, record);
    return Promise.resolve(record);
  }

  saveProviderRecord(
    record: NotificationProviderRecord
  ): Promise<NotificationProviderRecord> {
    this.#providerRecords.set(record.id, record);
    return Promise.resolve(record);
  }

  saveTemplate(template: NotificationTemplate): Promise<NotificationTemplate> {
    this.#templates.set(
      `${template.channel}:${template.templateKey}`,
      template
    );
    return Promise.resolve(template);
  }
}

export const defaultNotificationEventRepository =
  new InMemoryNotificationEventRepository();

export const createInMemoryNotificationEventRepository =
  (): NotificationEventRepository => new InMemoryNotificationEventRepository();

export const createResettableInMemoryNotificationEventRepository =
  (): ResettableNotificationEventRepository =>
    new InMemoryNotificationEventRepository();
