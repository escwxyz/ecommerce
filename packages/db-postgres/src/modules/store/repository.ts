import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import { StoreRepositoryService, StoreSettingsSchema } from "@ecommerce/store";
import type {
  StoreExpectedError,
  StoreRepository,
  StoreSettings,
} from "@ecommerce/store";
import { desc } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import type { Effect as EffectValue } from "effect/Effect";
import type { SqlError } from "effect/unstable/sql/SqlError";

import {
  CurrentPostgresTransactionService,
  PostgresDrizzleService,
} from "../../postgres-drizzle";
import type {
  PostgresDrizzleDatabase,
  PostgresDrizzleService as PostgresDrizzleServiceShape,
  PostgresDrizzleTransaction,
} from "../../postgres-drizzle";
import {
  StorePostgresInsertSchema,
  StorePostgresRowSchema,
  postgresStore,
} from "./schema";
import type { StorePostgresInsert, StorePostgresRow } from "./schema";

type StorePostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const storeRepositoryName = "StoreRepository";
const storeEntityName = "store";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: storeRepositoryName,
    });

const toRepositoryDecodeFailure = (
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity: storeEntityName,
    operation,
    repository: storeRepositoryName,
  });

const getStoreExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<StorePostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

/** Converts a validated domain settings record into a PostgreSQL insert row. */
export const toStorePostgresInsert = (
  settings: StoreSettings
): EffectValue<StorePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(StorePostgresInsertSchema)({
    createdAt: settings.createdAt,
    defaultCurrencyCode: settings.defaultCurrencyCode,
    defaultLocale: settings.defaultLocale,
    defaultRegionId: settings.defaultRegionId,
    defaultSalesChannelId: settings.defaultSalesChannelId,
    id: settings.id,
    metadataJson: settings.metadata,
    name: settings.name,
    supportedCurrencyCodesJson: settings.supportedCurrencyCodes,
    timezone: settings.timezone,
    updatedAt: settings.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("write")));

/** Converts a decoded PostgreSQL row into store domain settings. */
export const toStoreSettings = (
  row: StorePostgresRow
): EffectValue<StoreSettings, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(StoreSettingsSchema)({
    createdAt: row.createdAt,
    defaultCurrencyCode: row.defaultCurrencyCode,
    defaultLocale: row.defaultLocale,
    defaultRegionId: row.defaultRegionId,
    defaultSalesChannelId: row.defaultSalesChannelId,
    id: row.id,
    metadata: row.metadataJson,
    name: row.name,
    supportedCurrencyCodes: row.supportedCurrencyCodesJson,
    timezone: row.timezone,
    updatedAt: row.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("read")));

const decodeStoreRow = (
  row: unknown
): EffectValue<StoreSettings, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(StorePostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("read")),
    Effect.flatMap(toStoreSettings)
  );

const readStoreSettings = (
  service: PostgresDrizzleServiceShape
): EffectValue<StoreSettings | null, StoreExpectedError> =>
  Effect.gen(function* readStoreSettingsGenerator() {
    const executor = yield* getStoreExecutor(service);
    const rows = yield* executor
      .select()
      .from(postgresStore)
      .orderBy(desc(postgresStore.updatedAt), desc(postgresStore.id))
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const [row] = rows;

    if (!row) {
      return null;
    }

    return yield* decodeStoreRow(row);
  });

const saveStoreSettings = ({
  service,
  settings,
}: {
  readonly service: PostgresDrizzleServiceShape;
  readonly settings: StoreSettings;
}): EffectValue<StoreSettings, StoreExpectedError> =>
  Effect.gen(function* saveStoreSettingsGenerator() {
    const executor = yield* getStoreExecutor(service);
    const insert = yield* toStorePostgresInsert(settings);
    const rows = yield* executor
      .insert(postgresStore)
      .values(insert)
      .onConflictDoUpdate({
        set: {
          createdAt: insert.createdAt,
          defaultCurrencyCode: insert.defaultCurrencyCode,
          defaultLocale: insert.defaultLocale,
          defaultRegionId: insert.defaultRegionId,
          defaultSalesChannelId: insert.defaultSalesChannelId,
          metadataJson: insert.metadataJson,
          name: insert.name,
          supportedCurrencyCodesJson: insert.supportedCurrencyCodesJson,
          timezone: insert.timezone,
          updatedAt: insert.updatedAt,
        },
        target: postgresStore.id,
      })
      .returning()
      .pipe(Effect.mapError(toRepositoryUnavailable("write")));
    const [row] = rows;

    if (!row) {
      return yield* Effect.fail(toRepositoryUnavailable("write")());
    }

    return yield* decodeStoreRow(row);
  });

/** Creates the PostgreSQL-backed store repository contract implementation. */
export const createPostgresStoreRepository = (
  service: PostgresDrizzleServiceShape
): StoreRepository =>
  StoreRepositoryService.of({
    getStoreSettings: readStoreSettings(service),
    saveStoreSettings: (settings) =>
      saveStoreSettings({
        service,
        settings,
      }),
  });

/**
 * PostgreSQL store repository Layer.
 *
 * It provides the runtime-neutral `StoreRepositoryService` while keeping
 * Drizzle, PostgreSQL, codecs, and transaction handles inside
 * `@ecommerce/db-postgres`.
 */
export const createPostgresStoreRepositoryLayer = () =>
  Layer.effect(
    StoreRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresStoreRepository(service))
    )
  );

/** Production PostgreSQL store repository Layer. */
export const PostgresStoreRepositoryLayer =
  createPostgresStoreRepositoryLayer();

/**
 * Runs a store repository Effect inside the current PostgreSQL transaction
 * boundary without exposing transaction handles to the store module contract.
 */
export const withPostgresStoreTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
