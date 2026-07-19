import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresRegion,
  postgresRegionCountry,
  postgresSalesChannel,
  postgresSalesChannelProduct,
} from "./schema";

const repositoryName = "RegionSalesChannelRepository";

const toRegionSalesChannelResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: repositoryName,
  });

/** Deletes region and sales-channel rows for local PostgreSQL contract tests. */
export const resetPostgresRegionSalesChannelTables = PostgresDrizzleService.use(
  (service) =>
    service.withTransaction((transaction) =>
      transaction
        .delete(postgresSalesChannelProduct)
        .pipe(Effect.asVoid)
        .pipe(
          Effect.andThen(
            transaction.delete(postgresSalesChannel).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresRegionCountry).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresRegion).pipe(Effect.asVoid)
          ),
          Effect.mapError(toRegionSalesChannelResetFailure)
        )
    )
);
