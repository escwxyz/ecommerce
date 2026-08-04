import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresPromotion,
  postgresPromotionCampaign,
  postgresPromotionRedemption,
  postgresPromotionRule,
  postgresPromotionUsageLimit,
} from "./schema";

const promotionRepositoryName = "PromotionRepository";

const toPromotionResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: promotionRepositoryName,
  });

/** Deletes promotion rows for local PostgreSQL repository contract tests. */
export const resetPostgresPromotionTables = PostgresDrizzleService.use(
  (service) =>
    service.withTransaction((transaction) =>
      transaction
        .delete(postgresPromotionRedemption)
        .pipe(Effect.asVoid)
        .pipe(
          Effect.andThen(
            transaction.delete(postgresPromotionUsageLimit).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPromotionRule).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPromotion).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPromotionCampaign).pipe(Effect.asVoid)
          ),
          Effect.mapError(toPromotionResetFailure)
        )
    )
);
