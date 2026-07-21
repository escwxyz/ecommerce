import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresCart,
  postgresCartAdjustment,
  postgresCartLineItem,
} from "./schema";

const cartRepositoryName = "CartRepository";

const toCartResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: cartRepositoryName,
  });

/** Deletes cart rows for local PostgreSQL repository contract tests. */
export const resetPostgresCartTables = PostgresDrizzleService.use((service) =>
  service.withTransaction((transaction) =>
    transaction
      .delete(postgresCartAdjustment)
      .pipe(Effect.asVoid)
      .pipe(
        Effect.andThen(
          transaction.delete(postgresCartLineItem).pipe(Effect.asVoid)
        ),
        Effect.andThen(transaction.delete(postgresCart).pipe(Effect.asVoid)),
        Effect.mapError(toCartResetFailure)
      )
  )
);
