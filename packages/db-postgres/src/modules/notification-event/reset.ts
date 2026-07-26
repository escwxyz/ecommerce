import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresEventOutbox,
  postgresNotificationDispatch,
  postgresNotificationProvider,
  postgresNotificationTemplate,
} from "./schema";

const notificationEventRepositoryName = "NotificationEventRepository";

const toNotificationEventResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: notificationEventRepositoryName,
  });

/** Deletes notification-event rows for local PostgreSQL repository contract tests. */
export const resetPostgresNotificationEventTables = PostgresDrizzleService.use(
  (service) =>
    Effect.all(
      [
        service.database.delete(postgresNotificationDispatch),
        service.database.delete(postgresNotificationTemplate),
        service.database.delete(postgresNotificationProvider),
        service.database.delete(postgresEventOutbox),
      ],
      { discard: true }
    ).pipe(Effect.mapError(toNotificationEventResetFailure))
);
