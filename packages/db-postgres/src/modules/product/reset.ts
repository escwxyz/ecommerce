import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import { postgresProduct } from "./schema";

const productRepositoryName = "ProductRepository";

const toProductResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: productRepositoryName,
  });

/** Deletes product rows for local PostgreSQL repository contract tests. */
export const resetPostgresProductTables = PostgresDrizzleService.use(
  (service) =>
    service.database
      .delete(postgresProduct)
      .pipe(Effect.asVoid, Effect.mapError(toProductResetFailure))
);
