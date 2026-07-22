import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresFulfillment,
  postgresFulfillmentProvider,
  postgresFulfillmentSet,
  postgresReturnShipmentLink,
  postgresServiceZone,
  postgresShipment,
  postgresShippingOption,
  postgresShippingProfile,
} from "./schema";

const fulfillmentRepositoryName = "FulfillmentRepository";

const toFulfillmentResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: fulfillmentRepositoryName,
  });

/** Deletes fulfillment rows for local PostgreSQL repository contract tests. */
export const resetPostgresFulfillmentTables = PostgresDrizzleService.use(
  (service) =>
    service.withTransaction((transaction) =>
      transaction
        .delete(postgresReturnShipmentLink)
        .pipe(Effect.asVoid)
        .pipe(
          Effect.andThen(
            transaction.delete(postgresShipment).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresFulfillment).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresShippingOption).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresServiceZone).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresShippingProfile).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresFulfillmentSet).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresFulfillmentProvider).pipe(Effect.asVoid)
          ),
          Effect.mapError(toFulfillmentResetFailure)
        )
    )
);
