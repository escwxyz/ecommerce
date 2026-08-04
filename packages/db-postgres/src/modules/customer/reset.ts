import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresCustomer,
  postgresCustomerAddress,
  postgresCustomerGroup,
  postgresCustomerGroupCustomer,
} from "./schema";

const customerRepositoryName = "CustomerRepository";

const toCustomerResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: customerRepositoryName,
  });

/** Deletes customer rows for local PostgreSQL repository contract tests. */
export const resetPostgresCustomerTables = PostgresDrizzleService.use(
  (service) =>
    service.database
      .delete(postgresCustomerGroupCustomer)
      .pipe(Effect.asVoid, Effect.mapError(toCustomerResetFailure))
      .pipe(
        Effect.andThen(
          service.database
            .delete(postgresCustomerAddress)
            .pipe(Effect.asVoid, Effect.mapError(toCustomerResetFailure))
        ),
        Effect.andThen(
          service.database
            .delete(postgresCustomer)
            .pipe(Effect.asVoid, Effect.mapError(toCustomerResetFailure))
        ),
        Effect.andThen(
          service.database
            .delete(postgresCustomerGroup)
            .pipe(Effect.asVoid, Effect.mapError(toCustomerResetFailure))
        )
      )
);
