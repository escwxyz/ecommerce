import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  RegionRecordSchema,
  RegionRepositoryService,
  SalesChannelRecordSchema,
  SalesChannelRepositoryService,
  createRegionIdEffect,
  createSalesChannelIdEffect,
} from "@ecommerce/region-sales-channel";
import type {
  RegionRecord,
  RegionRepository,
  RegionSalesChannelExpectedError,
  SalesChannelRecord,
  SalesChannelRepository,
} from "@ecommerce/region-sales-channel";
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
  RegionCountryPostgresInsertSchema,
  RegionCountryPostgresRowSchema,
  RegionPostgresInsertSchema,
  RegionPostgresRowSchema,
  SalesChannelPostgresInsertSchema,
  SalesChannelPostgresRowSchema,
  SalesChannelProductPostgresInsertSchema,
  SalesChannelProductPostgresRowSchema,
  postgresRegion,
  postgresRegionCountry,
  postgresSalesChannel,
  postgresSalesChannelProduct,
} from "./schema";
import type {
  RegionCountryPostgresInsert,
  RegionCountryPostgresRow,
  RegionPostgresInsert,
  RegionPostgresRow,
  SalesChannelPostgresInsert,
  SalesChannelPostgresRow,
  SalesChannelProductPostgresInsert,
  SalesChannelProductPostgresRow,
} from "./schema";

type RegionSalesChannelPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const repositoryName = "RegionSalesChannelRepository";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: repositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "region"
    | "region-country"
    | "sales-channel"
    | "sales-channel-product",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: repositoryName,
  });

const expectedErrorTags = new Set([
  "RegionInvalidIdentifier",
  "RegionNotFound",
  "RegionSalesChannelEventPublishFailure",
  "RegionValidationFailure",
  "RepositoryConflict",
  "RepositoryDecodeFailure",
  "RepositoryUnavailable",
  "SalesChannelInvalidIdentifier",
  "SalesChannelNotFound",
  "SalesChannelValidationFailure",
]);

const isTaggedExpectedError = (
  error: unknown
): error is RegionSalesChannelExpectedError => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) {
    return false;
  }

  const tag = error._tag;
  return typeof tag === "string" && expectedErrorTags.has(tag);
};

const normalizeTransactionError = (
  error: unknown
): RegionSalesChannelExpectedError =>
  isTaggedExpectedError(error) ? error : toRepositoryUnavailable("write")();

const getExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<RegionSalesChannelPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

const runInRepositoryTransaction = <A, R>(
  service: PostgresDrizzleServiceShape,
  effect: EffectValue<A, RegionSalesChannelExpectedError, R>
): EffectValue<A, RegionSalesChannelExpectedError, R> =>
  Effect.serviceOption(CurrentPostgresTransactionService).pipe(
    Effect.flatMap((transaction) =>
      Option.match(transaction, {
        onNone: () =>
          service
            .withTransaction(() => effect)
            .pipe(Effect.mapError(normalizeTransactionError)),
        onSome: () => effect,
      })
    )
  );

export const toRegionPostgresInsert = (
  region: RegionRecord
): EffectValue<RegionPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(RegionPostgresInsertSchema)({
    createdAt: region.createdAt,
    currencyCode: region.currencyCode,
    fulfillmentOptionIdsJson: region.providerAvailability.fulfillmentOptionIds,
    id: region.id,
    metadataJson: region.metadata,
    name: region.name,
    paymentProviderIdsJson: region.providerAvailability.paymentProviderIds,
    taxProviderId: region.providerAvailability.taxProviderId,
    updatedAt: region.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("region", "write")));

export const toRegionCountryPostgresInserts = (
  region: RegionRecord
): EffectValue<
  readonly RegionCountryPostgresInsert[],
  RepositoryDecodeFailure
> =>
  Effect.all(
    region.countries.map((countryCode) =>
      Schema.decodeUnknownEffect(RegionCountryPostgresInsertSchema)({
        countryCode,
        regionId: region.id,
      }).pipe(
        Effect.mapError(() =>
          toRepositoryDecodeFailure("region-country", "write")
        )
      )
    )
  );

export const toSalesChannelPostgresInsert = (
  channel: SalesChannelRecord
): EffectValue<SalesChannelPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(SalesChannelPostgresInsertSchema)({
    createdAt: channel.createdAt,
    description: channel.description,
    id: channel.id,
    metadataJson: channel.metadata,
    name: channel.name,
    status: channel.status,
    updatedAt: channel.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("sales-channel", "write"))
  );

export const toSalesChannelProductPostgresInserts = (
  channel: SalesChannelRecord
): EffectValue<
  readonly SalesChannelProductPostgresInsert[],
  RepositoryDecodeFailure
> =>
  Effect.all(
    channel.productIds.map((productId) =>
      Schema.decodeUnknownEffect(SalesChannelProductPostgresInsertSchema)({
        productId,
        salesChannelId: channel.id,
      }).pipe(
        Effect.mapError(() =>
          toRepositoryDecodeFailure("sales-channel-product", "write")
        )
      )
    )
  );

export const toRegionRecord = ({
  countries,
  row,
}: {
  readonly countries: readonly RegionCountryPostgresRow[];
  readonly row: RegionPostgresRow;
}): EffectValue<RegionRecord, RegionSalesChannelExpectedError> =>
  Effect.gen(function* toRegionRecordEffect() {
    const id = yield* createRegionIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(RegionRecordSchema)({
      countries: countries.map((country) => country.countryCode),
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id,
      metadata: row.metadataJson,
      name: row.name,
      providerAvailability: {
        fulfillmentOptionIds: row.fulfillmentOptionIdsJson,
        paymentProviderIds: row.paymentProviderIdsJson,
        taxProviderId: row.taxProviderId,
      },
      updatedAt: row.updatedAt,
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("region", "read")));
  });

export const toSalesChannelRecord = ({
  products,
  row,
}: {
  readonly products: readonly SalesChannelProductPostgresRow[];
  readonly row: SalesChannelPostgresRow;
}): EffectValue<SalesChannelRecord, RegionSalesChannelExpectedError> =>
  Effect.gen(function* toSalesChannelRecordEffect() {
    const id = yield* createSalesChannelIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(SalesChannelRecordSchema)({
      createdAt: row.createdAt,
      description: row.description,
      id,
      metadata: row.metadataJson,
      name: row.name,
      productIds: products.map((product) => product.productId),
      status: row.status,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("sales-channel", "read"))
    );
  });

const decodeRegionRow = (
  row: unknown
): EffectValue<RegionPostgresRow, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(RegionPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("region", "read"))
  );

const decodeRegionCountryRow = (
  row: unknown
): EffectValue<RegionCountryPostgresRow, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(RegionCountryPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("region-country", "read"))
  );

const decodeSalesChannelRow = (
  row: unknown
): EffectValue<SalesChannelPostgresRow, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(SalesChannelPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("sales-channel", "read"))
  );

const decodeSalesChannelProductRow = (
  row: unknown
): EffectValue<SalesChannelProductPostgresRow, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(SalesChannelProductPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("sales-channel-product", "read")
    )
  );

const readRegionCountries = ({
  executor,
  regionId,
}: {
  readonly executor: RegionSalesChannelPostgresExecutor;
  readonly regionId: string;
}): EffectValue<
  readonly RegionCountryPostgresRow[],
  RegionSalesChannelExpectedError
> =>
  Effect.gen(function* readRegionCountriesEffect() {
    const rows = yield* executor
      .select()
      .from(postgresRegionCountry)
      .where(eq(postgresRegionCountry.regionId, regionId))
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    return yield* Effect.all(rows.map(decodeRegionCountryRow));
  });

const readSalesChannelProducts = ({
  executor,
  salesChannelId,
}: {
  readonly executor: RegionSalesChannelPostgresExecutor;
  readonly salesChannelId: string;
}): EffectValue<
  readonly SalesChannelProductPostgresRow[],
  RegionSalesChannelExpectedError
> =>
  Effect.gen(function* readSalesChannelProductsEffect() {
    const rows = yield* executor
      .select()
      .from(postgresSalesChannelProduct)
      .where(eq(postgresSalesChannelProduct.salesChannelId, salesChannelId))
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));

    return yield* Effect.all(rows.map(decodeSalesChannelProductRow));
  });

const decodeRegionWithRelations = ({
  executor,
  row,
}: {
  readonly executor: RegionSalesChannelPostgresExecutor;
  readonly row: unknown;
}): EffectValue<RegionRecord, RegionSalesChannelExpectedError> =>
  Effect.gen(function* decodeRegionWithRelationsEffect() {
    const decodedRow = yield* decodeRegionRow(row);
    const countries = yield* readRegionCountries({
      executor,
      regionId: decodedRow.id,
    });

    return yield* toRegionRecord({ countries, row: decodedRow });
  });

const decodeSalesChannelWithRelations = ({
  executor,
  row,
}: {
  readonly executor: RegionSalesChannelPostgresExecutor;
  readonly row: unknown;
}): EffectValue<SalesChannelRecord, RegionSalesChannelExpectedError> =>
  Effect.gen(function* decodeSalesChannelWithRelationsEffect() {
    const decodedRow = yield* decodeSalesChannelRow(row);
    const products = yield* readSalesChannelProducts({
      executor,
      salesChannelId: decodedRow.id,
    });

    return yield* toSalesChannelRecord({ products, row: decodedRow });
  });

const createRegionRepository = (
  service: PostgresDrizzleServiceShape
): RegionRepository =>
  RegionRepositoryService.of({
    findRegionById: (id) =>
      Effect.gen(function* findRegionByIdEffect() {
        const executor = yield* getExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresRegion)
          .where(eq(postgresRegion.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const [row] = rows;

        return row ? yield* decodeRegionWithRelations({ executor, row }) : null;
      }),
    listRegions: Effect.gen(function* listRegionsEffect() {
      const executor = yield* getExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresRegion)
        .orderBy(desc(postgresRegion.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(
        rows.map((row) => decodeRegionWithRelations({ executor, row }))
      );
    }),
    saveRegion: (region) =>
      runInRepositoryTransaction(
        service,
        Effect.gen(function* saveRegionEffect() {
          const executor = yield* getExecutor(service);
          const insert = yield* toRegionPostgresInsert(region);
          const countryInserts = yield* toRegionCountryPostgresInserts(region);

          yield* executor
            .insert(postgresRegion)
            .values(insert)
            .onConflictDoUpdate({
              set: {
                currencyCode: insert.currencyCode,
                fulfillmentOptionIdsJson: insert.fulfillmentOptionIdsJson,
                metadataJson: insert.metadataJson,
                name: insert.name,
                paymentProviderIdsJson: insert.paymentProviderIdsJson,
                taxProviderId: insert.taxProviderId,
                updatedAt: insert.updatedAt,
              },
              target: postgresRegion.id,
            })
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
          yield* executor
            .delete(postgresRegionCountry)
            .where(eq(postgresRegionCountry.regionId, region.id))
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("delete"))
            );

          if (countryInserts.length > 0) {
            yield* executor
              .insert(postgresRegionCountry)
              .values([...countryInserts])
              .pipe(
                Effect.asVoid,
                Effect.mapError(toRepositoryUnavailable("write"))
              );
          }

          return region;
        })
      ),
  });

const createSalesChannelRepository = (
  service: PostgresDrizzleServiceShape
): SalesChannelRepository =>
  SalesChannelRepositoryService.of({
    findSalesChannelById: (id) =>
      Effect.gen(function* findSalesChannelByIdEffect() {
        const executor = yield* getExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresSalesChannel)
          .where(eq(postgresSalesChannel.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const [row] = rows;

        return row
          ? yield* decodeSalesChannelWithRelations({ executor, row })
          : null;
      }),
    listSalesChannels: Effect.gen(function* listSalesChannelsEffect() {
      const executor = yield* getExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresSalesChannel)
        .orderBy(desc(postgresSalesChannel.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(
        rows.map((row) => decodeSalesChannelWithRelations({ executor, row }))
      );
    }),
    saveSalesChannel: (channel) =>
      runInRepositoryTransaction(
        service,
        Effect.gen(function* saveSalesChannelEffect() {
          const executor = yield* getExecutor(service);
          const insert = yield* toSalesChannelPostgresInsert(channel);
          const productInserts =
            yield* toSalesChannelProductPostgresInserts(channel);

          yield* executor
            .insert(postgresSalesChannel)
            .values(insert)
            .onConflictDoUpdate({
              set: {
                description: insert.description,
                metadataJson: insert.metadataJson,
                name: insert.name,
                status: insert.status,
                updatedAt: insert.updatedAt,
              },
              target: postgresSalesChannel.id,
            })
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("write"))
            );
          yield* executor
            .delete(postgresSalesChannelProduct)
            .where(eq(postgresSalesChannelProduct.salesChannelId, channel.id))
            .pipe(
              Effect.asVoid,
              Effect.mapError(toRepositoryUnavailable("delete"))
            );

          if (productInserts.length > 0) {
            yield* executor
              .insert(postgresSalesChannelProduct)
              .values([...productInserts])
              .pipe(
                Effect.asVoid,
                Effect.mapError(toRepositoryUnavailable("write"))
              );
          }

          return channel;
        })
      ),
  });

export const createPostgresRegionRepository = createRegionRepository;
export const createPostgresSalesChannelRepository =
  createSalesChannelRepository;

export const createPostgresRegionSalesChannelRepositoryLayer = () =>
  Layer.effect(
    RegionRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresRegionRepository(service))
    )
  ).pipe(
    Layer.merge(
      Layer.effect(
        SalesChannelRepositoryService,
        PostgresDrizzleService.use((service) =>
          Effect.succeed(createPostgresSalesChannelRepository(service))
        )
      )
    )
  );

export const PostgresRegionSalesChannelRepositoryLayer =
  createPostgresRegionSalesChannelRepositoryLayer();

export const withPostgresRegionSalesChannelTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
