import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  FulfillmentRepositoryService,
  createFulfillmentIdEffect,
  createFulfillmentProviderRecordIdEffect,
  createFulfillmentSetIdEffect,
  createReturnShipmentLinkIdEffect,
  createServiceZoneIdEffect,
  createShipmentRecordIdEffect,
  createShippingOptionIdEffect,
  createShippingProfileIdEffect,
} from "@ecommerce/fulfillment";
import type {
  Fulfillment,
  FulfillmentProviderRecord,
  FulfillmentRepository,
  FulfillmentSet,
  ReturnShipmentLink,
  ServiceZone,
  ShipmentRecord,
  ShippingOption,
  ShippingProfile,
} from "@ecommerce/fulfillment";
import { desc, eq, sql } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";
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
  postgresFulfillment,
  postgresFulfillmentProvider,
  postgresFulfillmentSet,
  postgresReturnShipmentLink,
  postgresServiceZone,
  postgresShipment,
  postgresShippingOption,
  postgresShippingProfile,
} from "./schema";

type FulfillmentPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const fulfillmentRepositoryName = "FulfillmentRepository";

const toRepositoryUnavailable =
  (operation: "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: fulfillmentRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity: string,
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: fulfillmentRepositoryName,
  });

const getFulfillmentExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<FulfillmentPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

const parsePriceAmount = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value);

const toProviderRecord = (
  row: typeof postgresFulfillmentProvider.$inferSelect
) =>
  Effect.gen(function* decodeProviderRowEffect() {
    return {
      createdAt: row.createdAt,
      id: yield* createFulfillmentProviderRecordIdEffect(row.id),
      isEnabled: row.isEnabled === "true",
      providerKey: row.providerKey,
      providerRecordId: row.providerRecordId,
      updatedAt: row.updatedAt,
    } satisfies FulfillmentProviderRecord;
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("fulfillment-provider", "read")
    )
  );

const toFulfillmentSet = (row: typeof postgresFulfillmentSet.$inferSelect) =>
  Effect.gen(function* decodeFulfillmentSetRowEffect() {
    return {
      createdAt: row.createdAt,
      id: yield* createFulfillmentSetIdEffect(row.id),
      metadata: row.metadataJson,
      name: row.name,
      updatedAt: row.updatedAt,
    } satisfies FulfillmentSet;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("fulfillment-set", "read"))
  );

const toShippingProfile = (row: typeof postgresShippingProfile.$inferSelect) =>
  Effect.gen(function* decodeShippingProfileRowEffect() {
    return {
      createdAt: row.createdAt,
      fulfillmentSetId: yield* createFulfillmentSetIdEffect(
        row.fulfillmentSetId
      ),
      id: yield* createShippingProfileIdEffect(row.id),
      metadata: row.metadataJson,
      name: row.name,
      updatedAt: row.updatedAt,
    } satisfies ShippingProfile;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("shipping-profile", "read"))
  );

const toServiceZone = (row: typeof postgresServiceZone.$inferSelect) =>
  Effect.gen(function* decodeServiceZoneRowEffect() {
    return {
      countryCodes: row.countryCodesJson,
      createdAt: row.createdAt,
      fulfillmentSetId: yield* createFulfillmentSetIdEffect(
        row.fulfillmentSetId
      ),
      id: yield* createServiceZoneIdEffect(row.id),
      metadata: row.metadataJson,
      name: row.name,
      regionIds: row.regionIdsJson,
      updatedAt: row.updatedAt,
    } satisfies ServiceZone;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("service-zone", "read"))
  );

const toShippingOption = (row: typeof postgresShippingOption.$inferSelect) =>
  Effect.gen(function* decodeShippingOptionRowEffect() {
    return {
      createdAt: row.createdAt,
      currencyCode: row.currencyCode ?? undefined,
      fulfillmentSetId: yield* createFulfillmentSetIdEffect(
        row.fulfillmentSetId
      ),
      id: yield* createShippingOptionIdEffect(row.id),
      isEnabled: row.isEnabled === "true",
      metadata: row.metadataJson,
      name: row.name,
      priceAmount: parsePriceAmount(row.priceAmount),
      profileId: yield* createShippingProfileIdEffect(row.profileId),
      providerKey: row.providerKey,
      providerServiceId: row.providerServiceId,
      serviceZoneId: yield* createServiceZoneIdEffect(row.serviceZoneId),
      updatedAt: row.updatedAt,
    } satisfies ShippingOption;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("shipping-option", "read"))
  );

const toFulfillment = (row: typeof postgresFulfillment.$inferSelect) =>
  Effect.gen(function* decodeFulfillmentRowEffect() {
    return {
      address: row.addressJson as Fulfillment["address"],
      createdAt: row.createdAt,
      id: yield* createFulfillmentIdEffect(row.id),
      idempotencyKey: row.idempotencyKey,
      items: row.itemsJson as Fulfillment["items"],
      metadata: row.metadataJson,
      orderId: row.orderId,
      providerFulfillmentId: row.providerFulfillmentId ?? undefined,
      providerKey: row.providerKey,
      shippingOptionId: yield* createShippingOptionIdEffect(
        row.shippingOptionId
      ),
      status: row.status as Fulfillment["status"],
      updatedAt: row.updatedAt,
    } satisfies Fulfillment;
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("fulfillment", "read"))
  );

const toShipment = (row: typeof postgresShipment.$inferSelect) =>
  Effect.gen(function* decodeShipmentRowEffect() {
    return {
      carrier: row.carrier ?? undefined,
      createdAt: row.createdAt,
      fulfillmentId: yield* createFulfillmentIdEffect(row.fulfillmentId),
      id: yield* createShipmentRecordIdEffect(row.id),
      labelUrl: row.labelUrl ?? undefined,
      metadata: row.metadataJson,
      providerShipmentId: row.providerShipmentId,
      status: row.status as ShipmentRecord["status"],
      trackingNumber: row.trackingNumber ?? undefined,
      trackingUrl: row.trackingUrl ?? undefined,
      updatedAt: row.updatedAt,
    } satisfies ShipmentRecord;
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("shipment", "read")));

const toReturnShipmentLink = (
  row: typeof postgresReturnShipmentLink.$inferSelect
) =>
  Effect.gen(function* decodeReturnShipmentLinkRowEffect() {
    return {
      createdAt: row.createdAt,
      fulfillmentId: yield* createFulfillmentIdEffect(row.fulfillmentId),
      id: yield* createReturnShipmentLinkIdEffect(row.id),
      providerReturnId: row.providerReturnId ?? undefined,
      returnId: row.returnId,
      shipmentId: yield* createShipmentRecordIdEffect(row.shipmentId),
      updatedAt: row.updatedAt,
    } satisfies ReturnShipmentLink;
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("return-shipment-link", "read")
    )
  );

const ensureRow = <TRow>(
  rows: readonly TRow[],
  entity: string
): EffectValue<TRow, RepositoryDecodeFailure> => {
  const [row] = rows;
  return row
    ? Effect.succeed(row)
    : Effect.fail(toRepositoryDecodeFailure(entity, "write"));
};

/** Creates the PostgreSQL-backed fulfillment repository contract implementation. */
export const createPostgresFulfillmentRepository = (
  service: PostgresDrizzleServiceShape
): FulfillmentRepository => {
  const readRows = <TRow>(
    operation: (
      executor: FulfillmentPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* readFulfillmentRowsEffect() {
      const executor = yield* getFulfillmentExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("read"))
      );
    });

  const writeRows = <TRow>(
    operation: (
      executor: FulfillmentPostgresExecutor
    ) => EffectValue<TRow[], unknown>
  ) =>
    Effect.gen(function* writeFulfillmentRowsEffect() {
      const executor = yield* getFulfillmentExecutor(service);
      return yield* operation(executor).pipe(
        Effect.mapError(toRepositoryUnavailable("write"))
      );
    });

  return {
    findFulfillmentById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresFulfillment)
          .where(eq(postgresFulfillment.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toFulfillment(row) : Effect.succeed(null)
        )
      ),
    findFulfillmentByIdempotencyKey: (idempotencyKey) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresFulfillment)
          .where(eq(postgresFulfillment.idempotencyKey, idempotencyKey))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toFulfillment(row) : Effect.succeed(null)
        )
      ),
    findFulfillmentSetById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresFulfillmentSet)
          .where(eq(postgresFulfillmentSet.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toFulfillmentSet(row) : Effect.succeed(null)
        )
      ),
    findServiceZoneById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresServiceZone)
          .where(eq(postgresServiceZone.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toServiceZone(row) : Effect.succeed(null)
        )
      ),
    findShipmentByFulfillmentId: (fulfillmentId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresShipment)
          .where(eq(postgresShipment.fulfillmentId, fulfillmentId))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toShipment(row) : Effect.succeed(null)
        )
      ),
    findShippingOptionById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresShippingOption)
          .where(eq(postgresShippingOption.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toShippingOption(row) : Effect.succeed(null)
        )
      ),
    findShippingProfileById: (id) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresShippingProfile)
          .where(eq(postgresShippingProfile.id, id))
      ).pipe(
        Effect.flatMap(([row]) =>
          row ? toShippingProfile(row) : Effect.succeed(null)
        )
      ),
    listFulfillments: readRows((executor) =>
      executor
        .select()
        .from(postgresFulfillment)
        .orderBy(desc(postgresFulfillment.createdAt))
    ).pipe(
      Effect.flatMap((rows) =>
        Effect.all(rows.map((row) => toFulfillment(row)))
      )
    ),
    listServiceZonesForSet: (fulfillmentSetId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresServiceZone)
          .where(eq(postgresServiceZone.fulfillmentSetId, fulfillmentSetId))
          .orderBy(desc(postgresServiceZone.createdAt))
      ).pipe(
        Effect.flatMap((rows) =>
          Effect.all(rows.map((row) => toServiceZone(row)))
        )
      ),
    listShipmentsForFulfillment: (fulfillmentId) =>
      readRows((executor) =>
        executor
          .select()
          .from(postgresShipment)
          .where(eq(postgresShipment.fulfillmentId, fulfillmentId))
          .orderBy(desc(postgresShipment.createdAt))
      ).pipe(
        Effect.flatMap((rows) => Effect.all(rows.map((row) => toShipment(row))))
      ),
    listShippingOptions: (input = {}) =>
      readRows((executor) => {
        const countryCode = input.countryCode?.toUpperCase();
        return executor
          .select({ option: postgresShippingOption })
          .from(postgresShippingOption)
          .innerJoin(
            postgresServiceZone,
            eq(postgresServiceZone.id, postgresShippingOption.serviceZoneId)
          )
          .where(
            sql`${postgresShippingOption.isEnabled} = 'true'
              AND (${input.fulfillmentSetId ?? null}::text IS NULL OR ${postgresShippingOption.fulfillmentSetId} = ${input.fulfillmentSetId ?? null})
              AND (${input.regionId ?? null}::text IS NULL OR ${postgresServiceZone.regionIdsJson} @> ${JSON.stringify(input.regionId ? [input.regionId] : [])}::jsonb)
              AND (${countryCode ?? null}::text IS NULL OR ${postgresServiceZone.countryCodesJson} @> ${JSON.stringify(countryCode ? [countryCode] : [])}::jsonb)`
          )
          .orderBy(desc(postgresShippingOption.createdAt))
          .pipe(Effect.map((rows) => rows.map((row) => row.option)));
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.all(rows.map((row) => toShippingOption(row)))
        )
      ),
    saveFulfillment: (fulfillment) =>
      writeRows((executor) =>
        executor
          .insert(postgresFulfillment)
          .values({
            addressJson: fulfillment.address,
            createdAt: fulfillment.createdAt,
            id: fulfillment.id,
            idempotencyKey: fulfillment.idempotencyKey,
            itemsJson: fulfillment.items,
            metadataJson: fulfillment.metadata,
            orderId: fulfillment.orderId,
            providerFulfillmentId: fulfillment.providerFulfillmentId ?? null,
            providerKey: fulfillment.providerKey,
            shippingOptionId: fulfillment.shippingOptionId,
            status: fulfillment.status,
            updatedAt: fulfillment.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              addressJson: fulfillment.address,
              itemsJson: fulfillment.items,
              metadataJson: fulfillment.metadata,
              providerFulfillmentId: fulfillment.providerFulfillmentId ?? null,
              status: fulfillment.status,
              updatedAt: fulfillment.updatedAt,
            },
            target: postgresFulfillment.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "fulfillment")),
        Effect.flatMap(toFulfillment)
      ),
    saveFulfillmentSet: (fulfillmentSet) =>
      writeRows((executor) =>
        executor
          .insert(postgresFulfillmentSet)
          .values({
            createdAt: fulfillmentSet.createdAt,
            id: fulfillmentSet.id,
            metadataJson: fulfillmentSet.metadata,
            name: fulfillmentSet.name,
            updatedAt: fulfillmentSet.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              metadataJson: fulfillmentSet.metadata,
              name: fulfillmentSet.name,
              updatedAt: fulfillmentSet.updatedAt,
            },
            target: postgresFulfillmentSet.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "fulfillment-set")),
        Effect.flatMap(toFulfillmentSet)
      ),
    saveProviderRecord: (record) =>
      writeRows((executor) =>
        executor
          .insert(postgresFulfillmentProvider)
          .values({
            createdAt: record.createdAt,
            id: record.id,
            isEnabled: record.isEnabled ? "true" : "false",
            providerKey: record.providerKey,
            providerRecordId: record.providerRecordId,
            updatedAt: record.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              isEnabled: record.isEnabled ? "true" : "false",
              providerRecordId: record.providerRecordId,
              updatedAt: record.updatedAt,
            },
            target: postgresFulfillmentProvider.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "fulfillment-provider")),
        Effect.flatMap(toProviderRecord)
      ),
    saveReturnShipmentLink: (link) =>
      writeRows((executor) =>
        executor
          .insert(postgresReturnShipmentLink)
          .values({
            createdAt: link.createdAt,
            fulfillmentId: link.fulfillmentId,
            id: link.id,
            providerReturnId: link.providerReturnId ?? null,
            returnId: link.returnId,
            shipmentId: link.shipmentId,
            updatedAt: link.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              providerReturnId: link.providerReturnId ?? null,
              updatedAt: link.updatedAt,
            },
            target: postgresReturnShipmentLink.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "return-shipment-link")),
        Effect.flatMap(toReturnShipmentLink)
      ),
    saveServiceZone: (serviceZone) =>
      writeRows((executor) =>
        executor
          .insert(postgresServiceZone)
          .values({
            countryCodesJson: serviceZone.countryCodes,
            createdAt: serviceZone.createdAt,
            fulfillmentSetId: serviceZone.fulfillmentSetId,
            id: serviceZone.id,
            metadataJson: serviceZone.metadata,
            name: serviceZone.name,
            regionIdsJson: serviceZone.regionIds,
            updatedAt: serviceZone.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              countryCodesJson: serviceZone.countryCodes,
              metadataJson: serviceZone.metadata,
              name: serviceZone.name,
              regionIdsJson: serviceZone.regionIds,
              updatedAt: serviceZone.updatedAt,
            },
            target: postgresServiceZone.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "service-zone")),
        Effect.flatMap(toServiceZone)
      ),
    saveShipment: (shipment) =>
      writeRows((executor) =>
        executor
          .insert(postgresShipment)
          .values({
            carrier: shipment.carrier ?? null,
            createdAt: shipment.createdAt,
            fulfillmentId: shipment.fulfillmentId,
            id: shipment.id,
            labelUrl: shipment.labelUrl ?? null,
            metadataJson: shipment.metadata,
            providerShipmentId: shipment.providerShipmentId,
            status: shipment.status,
            trackingNumber: shipment.trackingNumber ?? null,
            trackingUrl: shipment.trackingUrl ?? null,
            updatedAt: shipment.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              carrier: shipment.carrier ?? null,
              labelUrl: shipment.labelUrl ?? null,
              metadataJson: shipment.metadata,
              status: shipment.status,
              trackingNumber: shipment.trackingNumber ?? null,
              trackingUrl: shipment.trackingUrl ?? null,
              updatedAt: shipment.updatedAt,
            },
            target: postgresShipment.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "shipment")),
        Effect.flatMap(toShipment)
      ),
    saveShippingOption: (option) =>
      writeRows((executor) =>
        executor
          .insert(postgresShippingOption)
          .values({
            createdAt: option.createdAt,
            currencyCode: option.currencyCode ?? null,
            fulfillmentSetId: option.fulfillmentSetId,
            id: option.id,
            isEnabled: option.isEnabled ? "true" : "false",
            metadataJson: option.metadata,
            name: option.name,
            priceAmount:
              option.priceAmount === undefined
                ? null
                : String(option.priceAmount),
            profileId: option.profileId,
            providerKey: option.providerKey,
            providerServiceId: option.providerServiceId,
            serviceZoneId: option.serviceZoneId,
            updatedAt: option.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              currencyCode: option.currencyCode ?? null,
              isEnabled: option.isEnabled ? "true" : "false",
              metadataJson: option.metadata,
              name: option.name,
              priceAmount:
                option.priceAmount === undefined
                  ? null
                  : String(option.priceAmount),
              updatedAt: option.updatedAt,
            },
            target: postgresShippingOption.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "shipping-option")),
        Effect.flatMap(toShippingOption)
      ),
    saveShippingProfile: (profile) =>
      writeRows((executor) =>
        executor
          .insert(postgresShippingProfile)
          .values({
            createdAt: profile.createdAt,
            fulfillmentSetId: profile.fulfillmentSetId,
            id: profile.id,
            metadataJson: profile.metadata,
            name: profile.name,
            updatedAt: profile.updatedAt,
          })
          .onConflictDoUpdate({
            set: {
              metadataJson: profile.metadata,
              name: profile.name,
              updatedAt: profile.updatedAt,
            },
            target: postgresShippingProfile.id,
          })
          .returning()
      ).pipe(
        Effect.flatMap((rows) => ensureRow(rows, "shipping-profile")),
        Effect.flatMap(toShippingProfile)
      ),
  };
};

export const createPostgresFulfillmentRepositoryLayer = (
  service: PostgresDrizzleServiceShape
) =>
  Layer.succeed(
    FulfillmentRepositoryService,
    createPostgresFulfillmentRepository(service)
  );

export const PostgresFulfillmentRepositoryLayer = Layer.effect(
  FulfillmentRepositoryService,
  PostgresDrizzleService.use((service) =>
    Effect.succeed(createPostgresFulfillmentRepository(service))
  )
);

/** Runs an Effect inside a PostgreSQL fulfillment transaction using the active transaction service. */
export const withPostgresFulfillmentTransaction = <
  TValue,
  TError,
  TRequirements,
>(
  effect: EffectValue<TValue, TError, TRequirements>
): EffectValue<
  TValue,
  TError | SqlError,
  TRequirements | PostgresDrizzleService
> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
