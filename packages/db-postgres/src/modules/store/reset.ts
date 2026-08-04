import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import { postgresStore } from "./schema";

const storeRepositoryName = "StoreRepository";

const toStoreResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: storeRepositoryName,
  });

/** Deletes store rows for local PostgreSQL repository contract tests. */
export const resetPostgresStoreTables = PostgresDrizzleService.use((service) =>
  service.database
    .delete(postgresStore)
    .pipe(Effect.asVoid, Effect.mapError(toStoreResetFailure))
);
