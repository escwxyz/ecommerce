import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  TaxCategoryRecordSchema,
  TaxProviderConfigRecordSchema,
  TaxRateRecordSchema,
  TaxRegionRecordSchema,
  TaxRepositoryService,
  createTaxCategoryIdEffect,
  createTaxProviderConfigIdEffect,
  createTaxRateIdEffect,
  createTaxRegionIdEffect,
} from "@ecommerce/tax";
import type {
  TaxCategoryRecord,
  TaxProviderConfigRecord,
  TaxRateRecord,
  TaxRegionRecord,
  TaxRepository,
} from "@ecommerce/tax";
import { desc, eq } from "drizzle-orm";
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
  TaxCategoryPostgresInsertSchema,
  TaxCategoryPostgresRowSchema,
  TaxProviderConfigPostgresInsertSchema,
  TaxProviderConfigPostgresRowSchema,
  TaxRatePostgresInsertSchema,
  TaxRatePostgresRowSchema,
  TaxRegionPostgresInsertSchema,
  TaxRegionPostgresRowSchema,
  postgresTaxCategory,
  postgresTaxProviderConfig,
  postgresTaxRate,
  postgresTaxRegion,
} from "./schema";
import type {
  TaxCategoryPostgresInsert,
  TaxCategoryPostgresRow,
  TaxProviderConfigPostgresInsert,
  TaxProviderConfigPostgresRow,
  TaxRatePostgresInsert,
  TaxRatePostgresRow,
  TaxRegionPostgresInsert,
  TaxRegionPostgresRow,
} from "./schema";

type TaxPostgresExecutor = PostgresDrizzleDatabase | PostgresDrizzleTransaction;

const taxRepositoryName = "TaxRepository";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: taxRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity: "tax-category" | "tax-provider-config" | "tax-rate" | "tax-region",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: taxRepositoryName,
  });

const getTaxExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<TaxPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toTaxCategoryPostgresInsert = (
  category: TaxCategoryRecord
): EffectValue<TaxCategoryPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxCategoryPostgresInsertSchema)({
    code: category.code,
    createdAt: category.createdAt,
    description: category.description,
    id: category.id,
    metadataJson: category.metadata,
    name: category.name,
    updatedAt: category.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as TaxCategoryPostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-category", "write"))
  );

export const toTaxProviderConfigPostgresInsert = (
  providerConfig: TaxProviderConfigRecord
): EffectValue<TaxProviderConfigPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxProviderConfigPostgresInsertSchema)({
    createdAt: providerConfig.createdAt,
    id: providerConfig.id,
    isActive: providerConfig.isActive ? "true" : "false",
    metadataJson: providerConfig.metadata,
    providerKey: providerConfig.providerKey,
    settingsJson: providerConfig.settings,
    updatedAt: providerConfig.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as TaxProviderConfigPostgresInsert),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("tax-provider-config", "write")
    )
  );

export const toTaxRegionPostgresInsert = (
  region: TaxRegionRecord
): EffectValue<TaxRegionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxRegionPostgresInsertSchema)({
    code: region.code,
    countryCode: region.countryCode,
    createdAt: region.createdAt,
    id: region.id,
    metadataJson: region.metadata,
    name: region.name,
    providerConfigId: region.providerConfigId,
    updatedAt: region.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as TaxRegionPostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-region", "write"))
  );

export const toTaxRatePostgresInsert = (
  rate: TaxRateRecord
): EffectValue<TaxRatePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxRatePostgresInsertSchema)({
    categoryId: rate.categoryId,
    createdAt: rate.createdAt,
    id: rate.id,
    metadataJson: rate.metadata,
    name: rate.name,
    percentage: rate.percentage,
    regionId: rate.regionId,
    updatedAt: rate.updatedAt,
  }).pipe(
    Effect.map((insert) => insert as TaxRatePostgresInsert),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-rate", "write"))
  );

const toCategoryRecord = (
  row: TaxCategoryPostgresRow
): EffectValue<TaxCategoryRecord, RepositoryDecodeFailure> =>
  Effect.gen(function* decodeTaxCategoryRowEffect() {
    const id = yield* createTaxCategoryIdEffect(row.id);
    return yield* Schema.decodeUnknownEffect(TaxCategoryRecordSchema)({
      code: row.code,
      createdAt: row.createdAt,
      description: row.description,
      id,
      metadata: row.metadataJson,
      name: row.name,
      updatedAt: row.updatedAt,
    });
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("tax-category", "read"))
  );

const toProviderConfigRecord = (
  row: TaxProviderConfigPostgresRow
): EffectValue<TaxProviderConfigRecord, RepositoryDecodeFailure> =>
  Effect.gen(function* decodeTaxProviderConfigRowEffect() {
    const id = yield* createTaxProviderConfigIdEffect(row.id);
    return yield* Schema.decodeUnknownEffect(TaxProviderConfigRecordSchema)({
      createdAt: row.createdAt,
      id,
      isActive: row.isActive === "true",
      metadata: row.metadataJson,
      providerKey: row.providerKey,
      settings: row.settingsJson,
      updatedAt: row.updatedAt,
    });
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("tax-provider-config", "read")
    )
  );

const toRegionRecord = (
  row: TaxRegionPostgresRow
): EffectValue<TaxRegionRecord, RepositoryDecodeFailure> =>
  Effect.gen(function* decodeTaxRegionRowEffect() {
    const id = yield* createTaxRegionIdEffect(row.id);
    const providerConfigId = row.providerConfigId
      ? yield* createTaxProviderConfigIdEffect(row.providerConfigId)
      : null;
    return yield* Schema.decodeUnknownEffect(TaxRegionRecordSchema)({
      code: row.code,
      countryCode: row.countryCode,
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      name: row.name,
      providerConfigId,
      updatedAt: row.updatedAt,
    });
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("tax-region", "read"))
  );

const toRateRecord = (
  row: TaxRatePostgresRow
): EffectValue<TaxRateRecord, RepositoryDecodeFailure> =>
  Effect.gen(function* decodeTaxRateRowEffect() {
    const id = yield* createTaxRateIdEffect(row.id);
    const regionId = yield* createTaxRegionIdEffect(row.regionId);
    const categoryId = row.categoryId
      ? yield* createTaxCategoryIdEffect(row.categoryId)
      : null;
    return yield* Schema.decodeUnknownEffect(TaxRateRecordSchema)({
      categoryId,
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      name: row.name,
      percentage: row.percentage,
      regionId,
      updatedAt: row.updatedAt,
    });
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("tax-rate", "read")));

const decodeCategoryRow = (
  row: unknown,
  operation: "read" | "write"
): EffectValue<TaxCategoryRecord, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxCategoryPostgresRowSchema)(row).pipe(
    Effect.flatMap(toCategoryRecord),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-category", operation))
  );

const decodeProviderConfigRow = (
  row: unknown,
  operation: "read" | "write"
): EffectValue<TaxProviderConfigRecord, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxProviderConfigPostgresRowSchema)(row).pipe(
    Effect.flatMap(toProviderConfigRecord),
    Effect.mapError(() =>
      toRepositoryDecodeFailure("tax-provider-config", operation)
    )
  );

const decodeRegionRow = (
  row: unknown,
  operation: "read" | "write"
): EffectValue<TaxRegionRecord, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxRegionPostgresRowSchema)(row).pipe(
    Effect.flatMap(toRegionRecord),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-region", operation))
  );

const decodeRateRow = (
  row: unknown,
  operation: "read" | "write"
): EffectValue<TaxRateRecord, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(TaxRatePostgresRowSchema)(row).pipe(
    Effect.flatMap(toRateRecord),
    Effect.mapError(() => toRepositoryDecodeFailure("tax-rate", operation))
  );

/** Creates the PostgreSQL-backed tax repository contract implementation. */
export const createPostgresTaxRepository = (
  service: PostgresDrizzleServiceShape
): TaxRepository => {
  const readRows = <TRow>(
    operation: (executor: TaxPostgresExecutor) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* readTaxRowsEffect() {
      const executor = yield* getTaxExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("read"))
      );
    });

  const writeReturning = <TRow>(
    operation: (executor: TaxPostgresExecutor) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* writeTaxRowsEffect() {
      const executor = yield* getTaxExecutor(service);
      const rows = yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("write"))
      );
      const [row] = rows;

      if (!row) {
        return yield* toRepositoryDecodeFailure("tax-region", "write");
      }

      return row;
    });

  return {
    findActiveProviderConfigByKey: (providerKey) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresTaxProviderConfig)
          .where(eq(postgresTaxProviderConfig.providerKey, providerKey))
      ).pipe(
        Effect.map(
          (rows) => rows.find((row) => row.isActive === "true") ?? null
        ),
        Effect.flatMap((row) =>
          row ? decodeProviderConfigRow(row, "read") : Effect.succeed(null)
        )
      ),
    findCategoryById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresTaxCategory)
          .where(eq(postgresTaxCategory.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? decodeCategoryRow(row, "read") : Effect.succeed(null)
        )
      ),
    findProviderConfigById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresTaxProviderConfig)
          .where(eq(postgresTaxProviderConfig.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? decodeProviderConfigRow(row, "read") : Effect.succeed(null)
        )
      ),
    findRatesByRegionId: (regionId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresTaxRate)
          .where(eq(postgresTaxRate.regionId, regionId))
          .orderBy(desc(postgresTaxRate.createdAt))
      ).pipe(
        Effect.flatMap((rows) =>
          Effect.all(rows.map((row) => decodeRateRow(row, "read")))
        )
      ),
    findRegionById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresTaxRegion)
          .where(eq(postgresTaxRegion.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? decodeRegionRow(row, "read") : Effect.succeed(null)
        )
      ),
    saveCategory: (category) =>
      toTaxCategoryPostgresInsert(category).pipe(
        Effect.flatMap((insert) =>
          writeReturning((executor) =>
            executor
              .insert(postgresTaxCategory)
              .values(insert)
              .onConflictDoUpdate({
                set: insert,
                target: postgresTaxCategory.id,
              })
              .returning()
          )
        ),
        Effect.flatMap((row) => decodeCategoryRow(row, "write"))
      ),
    saveProviderConfig: (providerConfig) =>
      toTaxProviderConfigPostgresInsert(providerConfig).pipe(
        Effect.flatMap((insert) =>
          writeReturning((executor) =>
            executor
              .insert(postgresTaxProviderConfig)
              .values(insert)
              .onConflictDoUpdate({
                set: insert,
                target: postgresTaxProviderConfig.id,
              })
              .returning()
          )
        ),
        Effect.flatMap((row) => decodeProviderConfigRow(row, "write"))
      ),
    saveRate: (rate) =>
      toTaxRatePostgresInsert(rate).pipe(
        Effect.flatMap((insert) =>
          writeReturning((executor) =>
            executor
              .insert(postgresTaxRate)
              .values(insert)
              .onConflictDoUpdate({ set: insert, target: postgresTaxRate.id })
              .returning()
          )
        ),
        Effect.flatMap((row) => decodeRateRow(row, "write"))
      ),
    saveRegion: (region) =>
      toTaxRegionPostgresInsert(region).pipe(
        Effect.flatMap((insert) =>
          writeReturning((executor) =>
            executor
              .insert(postgresTaxRegion)
              .values(insert)
              .onConflictDoUpdate({ set: insert, target: postgresTaxRegion.id })
              .returning()
          )
        ),
        Effect.flatMap((row) => decodeRegionRow(row, "write"))
      ),
  };
};

export const createPostgresTaxRepositoryLayer = (
  service: PostgresDrizzleServiceShape
) => Layer.succeed(TaxRepositoryService, createPostgresTaxRepository(service));

export const PostgresTaxRepositoryLayer = Layer.effect(
  TaxRepositoryService,
  PostgresDrizzleService.use((service) =>
    Effect.succeed(createPostgresTaxRepository(service))
  )
);

/** Runs an Effect inside a PostgreSQL tax transaction using the active transaction service. */
export const withPostgresTaxTransaction = <TValue, TError, TRequirements>(
  effect: EffectValue<TValue, TError, TRequirements>
): EffectValue<
  TValue,
  TError | SqlError,
  TRequirements | PostgresDrizzleService
> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
