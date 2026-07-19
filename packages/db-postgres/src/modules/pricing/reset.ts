import { RepositoryUnavailable } from "@ecommerce/core";
import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresPricingCurrency,
  postgresPricingMoneyAmount,
  postgresPricingPriceList,
  postgresPricingPricePreference,
  postgresPricingPriceRule,
  postgresPricingPriceSet,
} from "./schema";

const pricingRepositoryName = "PricingRepository";

const toPricingResetFailure = (): RepositoryUnavailable =>
  new RepositoryUnavailable({
    adapter: "effect-postgres",
    operation: "delete",
    repository: pricingRepositoryName,
  });

/** Deletes pricing rows for local PostgreSQL repository contract tests. */
export const resetPostgresPricingTables = PostgresDrizzleService.use(
  (service) =>
    service.withTransaction((transaction) =>
      transaction
        .delete(postgresPricingPricePreference)
        .pipe(Effect.asVoid)
        .pipe(
          Effect.andThen(
            transaction.delete(postgresPricingPriceRule).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPricingMoneyAmount).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPricingPriceList).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPricingPriceSet).pipe(Effect.asVoid)
          ),
          Effect.andThen(
            transaction.delete(postgresPricingCurrency).pipe(Effect.asVoid)
          ),
          Effect.mapError(toPricingResetFailure)
        )
    )
);
