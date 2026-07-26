import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import { postgresOrder } from "./schema";

const orderRepositoryName = "OrderRepository";

const toOrderResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: orderRepositoryName,
  });

/** Deletes order rows for local PostgreSQL repository contract tests. */
export const resetPostgresOrderTables = PostgresDrizzleService.use((service) =>
  service.database
    .delete(postgresOrder)
    .pipe(Effect.asVoid, Effect.mapError(toOrderResetFailure))
);
