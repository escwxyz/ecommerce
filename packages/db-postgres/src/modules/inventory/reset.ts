import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresInventoryAdjustmentEvent,
  postgresInventoryItem,
  postgresInventoryLevel,
  postgresInventoryReservation,
  postgresInventoryStockLocation,
} from "./schema";

const inventoryRepositoryName = "InventoryRepository";

const toInventoryResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: inventoryRepositoryName,
  });

/** Deletes inventory rows for local PostgreSQL repository contract tests. */
export const resetPostgresInventoryTables = PostgresDrizzleService.use(
  (service) =>
    service.withTransaction((transaction) =>
      transaction
        .delete(postgresInventoryAdjustmentEvent)
        .pipe(Effect.asVoid)
        .pipe(
          Effect.andThen(
            transaction.delete(postgresInventoryReservation).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresInventoryLevel).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction
              .delete(postgresInventoryStockLocation)
              .pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresInventoryItem).pipe(Effect.asVoid)
          ),
          Effect.mapError(toInventoryResetFailure)
        )
    )
);
