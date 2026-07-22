import { Effect } from "effect";

import { PostgresDrizzleService } from "../../postgres-drizzle";
import {
  postgresPayment,
  postgresPaymentAccountHolder,
  postgresPaymentCapture,
  postgresPaymentCollection,
  postgresPaymentMethod,
  postgresPaymentProvider,
  postgresPaymentRefund,
  postgresPaymentSession,
} from "./schema";

/** Deletes payment module tables in dependency order for contract-test resets. */
export const resetPostgresPaymentTables = PostgresDrizzleService.use(
  (service) =>
    Effect.gen(function* resetPostgresPaymentTablesEffect() {
      yield* service.database.delete(postgresPaymentRefund);
      yield* service.database.delete(postgresPaymentCapture);
      yield* service.database.delete(postgresPayment);
      yield* service.database.delete(postgresPaymentSession);
      yield* service.database.delete(postgresPaymentCollection);
      yield* service.database.delete(postgresPaymentMethod);
      yield* service.database.delete(postgresPaymentAccountHolder);
      yield* service.database.delete(postgresPaymentProvider);
    })
);
