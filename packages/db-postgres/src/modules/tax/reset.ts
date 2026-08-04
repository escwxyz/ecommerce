import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresTaxCategory,
  postgresTaxProviderConfig,
  postgresTaxRate,
  postgresTaxRegion,
} from "./schema";

const taxRepositoryName = "TaxRepository";

const toTaxResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: taxRepositoryName,
  });

/** Deletes tax rows for local PostgreSQL repository contract tests. */
export const resetPostgresTaxTables = PostgresDrizzleService.use((service) =>
  service.withTransaction((transaction) =>
    transaction
      .delete(postgresTaxRate)
      .pipe(Effect.asVoid)
      .pipe(
        Effect.andThen(
          transaction.delete(postgresTaxRegion).pipe(Effect.asVoid)
        ),
        Effect.andThen(
          transaction.delete(postgresTaxProviderConfig).pipe(Effect.asVoid)
        ),
        Effect.andThen(
          transaction.delete(postgresTaxCategory).pipe(Effect.asVoid)
        ),
        Effect.mapError(toTaxResetFailure)
      )
  )
);
