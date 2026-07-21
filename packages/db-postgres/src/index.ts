import { PgClient } from "@effect/sql-pg";
import * as PgDrizzleMigrator from "drizzle-orm/effect-postgres/migrator";
import { Layer, Redacted } from "effect";
import { types as pgTypes } from "pg";
import type { CustomTypesConfig } from "pg";

import { createPostgresMigrationConfig } from "./migration-config";
import type { PostgresMigrationRunnerOptions } from "./migration-config";
import {
  createPostgresDrizzleLayer,
  PostgresDrizzleService,
} from "./postgres-drizzle";
import type { PostgresDrizzleConfig } from "./postgres-drizzle";

export { postgresAdapterTarget } from "./adapter-constants";

export {
  createPostgresMigrationConfig,
  defaultPostgresMigrationsFolder,
  defaultPostgresMigrationsTable,
  type PostgresMigrationRunnerOptions,
} from "./migration-config";

export {
  commerceMigrationAudit,
  commerceMigrationAuditTableName,
  commerceOutbox,
  commerceOutboxDeadLetter,
  commerceOutboxDeadLetterTableName,
  commerceOutboxTableName,
  CartAdjustmentPostgresInsertSchema,
  CartAdjustmentPostgresRowSchema,
  CartLineItemPostgresInsertSchema,
  CartLineItemPostgresRowSchema,
  CartPostgresInsertSchema,
  CartPostgresRowSchema,
  CustomerAddressPostgresInsertSchema,
  CustomerAddressPostgresRowSchema,
  CustomerGroupPostgresInsertSchema,
  CustomerGroupPostgresRowSchema,
  CustomerPostgresInsertSchema,
  CustomerPostgresRowSchema,
  CustomerPostgresUpdateSchema,
  drizzleMigrationsTableName,
  postgresCustomer,
  postgresCustomerAddress,
  postgresCustomerAddressTableName,
  postgresCustomerGroup,
  postgresCustomerGroupCustomer,
  postgresCustomerGroupCustomerTableName,
  postgresCustomerGroupTableName,
  postgresCustomerTableName,
  postgresInventoryAdjustmentEvent,
  postgresInventoryAdjustmentEventTableName,
  postgresInventoryItem,
  postgresInventoryItemTableName,
  postgresInventoryLevel,
  postgresInventoryLevelTableName,
  postgresInventoryReservation,
  postgresInventoryReservationTableName,
  postgresInventoryStockLocation,
  postgresInventoryStockLocationTableName,
  postgresPricingCurrency,
  postgresPricingCurrencyTableName,
  postgresPricingMoneyAmount,
  postgresPricingMoneyAmountTableName,
  postgresPricingPriceList,
  postgresPricingPriceListTableName,
  postgresPricingPricePreference,
  postgresPricingPricePreferenceTableName,
  postgresPricingPriceRule,
  postgresPricingPriceRuleTableName,
  postgresPricingPriceSet,
  postgresPricingPriceSetTableName,
  postgresProduct,
  postgresProductTableName,
  postgresRegion,
  postgresRegionCountry,
  postgresRegionCountryTableName,
  postgresRegionTableName,
  postgresSalesChannel,
  postgresSalesChannelProduct,
  postgresSalesChannelProductTableName,
  postgresSalesChannelTableName,
  postgresStore,
  postgresStoreTableName,
  postgresFoundationSchema,
  postgresCart,
  postgresCartAdjustment,
  postgresCartAdjustmentTableName,
  postgresCartLineItem,
  postgresCartLineItemTableName,
  postgresCartTableName,
  type CommerceMigrationAuditInsert,
  type CommerceMigrationAuditRow,
  type CommerceOutboxDeadLetterInsert,
  type CommerceOutboxDeadLetterRow,
  type CommerceOutboxInsert,
  type CommerceOutboxRow,
  type CartAdjustmentPostgresInsert,
  type CartAdjustmentPostgresRow,
  type CartLineItemPostgresInsert,
  type CartLineItemPostgresRow,
  type CartPostgresInsert,
  type CartPostgresRow,
  type CustomerAddressPostgresInsert,
  type CustomerAddressPostgresRow,
  type CustomerGroupPostgresInsert,
  type CustomerGroupPostgresRow,
  type CustomerPostgresInsert,
  type CustomerPostgresRow,
  type CustomerPostgresUpdate,
  InventoryAdjustmentEventPostgresInsertSchema,
  InventoryAdjustmentEventPostgresRowSchema,
  InventoryItemPostgresInsertSchema,
  InventoryItemPostgresRowSchema,
  InventoryLevelPostgresInsertSchema,
  InventoryLevelPostgresRowSchema,
  InventoryReservationPostgresInsertSchema,
  InventoryReservationPostgresRowSchema,
  type InventoryAdjustmentEventPostgresInsert,
  type InventoryAdjustmentEventPostgresRow,
  type InventoryItemPostgresInsert,
  type InventoryItemPostgresRow,
  type InventoryLevelPostgresInsert,
  type InventoryLevelPostgresRow,
  type InventoryReservationPostgresInsert,
  type InventoryReservationPostgresRow,
  StockLocationPostgresInsertSchema,
  StockLocationPostgresRowSchema,
  type StockLocationPostgresInsert,
  type StockLocationPostgresRow,
  ProductPostgresInsertSchema,
  ProductPostgresRowSchema,
  ProductPostgresUpdateSchema,
  type ProductPostgresInsert,
  type ProductPostgresRow,
  type ProductPostgresUpdate,
  PricingCurrencyPostgresInsertSchema,
  PricingCurrencyPostgresRowSchema,
  PricingMoneyAmountPostgresInsertSchema,
  PricingMoneyAmountPostgresRowSchema,
  PricingPriceListPostgresInsertSchema,
  PricingPriceListPostgresRowSchema,
  PricingPricePreferencePostgresInsertSchema,
  PricingPricePreferencePostgresRowSchema,
  PricingPriceRulePostgresInsertSchema,
  PricingPriceRulePostgresRowSchema,
  PricingPriceSetPostgresInsertSchema,
  PricingPriceSetPostgresRowSchema,
  PricingPriceSetPostgresUpdateSchema,
  type PricingCurrencyPostgresInsert,
  type PricingCurrencyPostgresRow,
  type PricingMoneyAmountPostgresInsert,
  type PricingMoneyAmountPostgresRow,
  type PricingPriceListPostgresInsert,
  type PricingPriceListPostgresRow,
  type PricingPricePreferencePostgresInsert,
  type PricingPricePreferencePostgresRow,
  type PricingPriceRulePostgresInsert,
  type PricingPriceRulePostgresRow,
  type PricingPriceSetPostgresInsert,
  type PricingPriceSetPostgresRow,
  type PricingPriceSetPostgresUpdate,
  RegionCountryPostgresInsertSchema,
  RegionCountryPostgresRowSchema,
  RegionPostgresInsertSchema,
  RegionPostgresRowSchema,
  RegionPostgresUpdateSchema,
  type RegionCountryPostgresInsert,
  type RegionCountryPostgresRow,
  type RegionPostgresInsert,
  type RegionPostgresRow,
  type RegionPostgresUpdate,
  SalesChannelPostgresInsertSchema,
  SalesChannelPostgresRowSchema,
  SalesChannelPostgresUpdateSchema,
  SalesChannelProductPostgresInsertSchema,
  SalesChannelProductPostgresRowSchema,
  type SalesChannelPostgresInsert,
  type SalesChannelPostgresRow,
  type SalesChannelPostgresUpdate,
  type SalesChannelProductPostgresInsert,
  type SalesChannelProductPostgresRow,
  StorePostgresInsertSchema,
  StorePostgresRowSchema,
  StorePostgresUpdateSchema,
  type StorePostgresInsert,
  type StorePostgresRow,
  type StorePostgresUpdate,
} from "./schema/index";

export {
  PostgresCartRepositoryLayer,
  createPostgresCartRepository,
  createPostgresCartRepositoryLayer,
  resetPostgresCartTables,
  toCartAdjustmentPostgresInsert,
  toCartLineItemPostgresInsert,
  toCartPostgresInsert,
  withPostgresCartTransaction,
} from "./modules/cart/index";

export {
  createPostgresCustomerRepository,
  createPostgresCustomerRepositoryLayer,
  PostgresCustomerRepositoryLayer,
  resetPostgresCustomerTables,
  toCustomerAddressPostgresInsert,
  toCustomerGroup,
  toCustomerGroupPostgresInsert,
  toCustomerPostgresInsert,
  withPostgresCustomerTransaction,
} from "./modules/customer/index";

export {
  PostgresInventoryRepositoryLayer,
  createPostgresInventoryRepository,
  createPostgresInventoryRepositoryLayer,
  resetPostgresInventoryTables,
  toInventoryAdjustmentEventPostgresInsert,
  toInventoryItemPostgresInsert,
  toInventoryLevelPostgresInsert,
  toInventoryReservationPostgresInsert,
  toStockLocationPostgresInsert,
  withPostgresInventoryTransaction,
} from "./modules/inventory/index";

export {
  createPostgresProductRepository,
  createPostgresProductRepositoryLayer,
  PostgresProductRepositoryLayer,
  resetPostgresProductTables,
  toProductPostgresInsert,
  toProductRecord,
  withPostgresProductTransaction,
} from "./modules/product/index";

export {
  PostgresPricingRepositoryLayer,
  createPostgresPricingRepository,
  createPostgresPricingRepositoryLayer,
  resetPostgresPricingTables,
  toPricingCurrencyPostgresInsert,
  toPricingMoneyAmountPostgresInsert,
  toPricingPriceListPostgresInsert,
  toPricingPricePreferencePostgresInsert,
  toPricingPriceRulePostgresInsert,
  toPricingPriceSetPostgresInsert,
  withPostgresPricingTransaction,
} from "./modules/pricing/index";

export {
  PostgresRegionSalesChannelRepositoryLayer,
  createPostgresRegionRepository,
  createPostgresRegionSalesChannelRepositoryLayer,
  createPostgresSalesChannelRepository,
  resetPostgresRegionSalesChannelTables,
  toRegionCountryPostgresInserts,
  toRegionPostgresInsert,
  toRegionRecord,
  toSalesChannelPostgresInsert,
  toSalesChannelProductPostgresInserts,
  toSalesChannelRecord,
  withPostgresRegionSalesChannelTransaction,
} from "./modules/region-sales-channel/index";

export {
  createPostgresStoreRepository,
  createPostgresStoreRepositoryLayer,
  PostgresStoreRepositoryLayer,
  resetPostgresStoreTables,
  toStorePostgresInsert,
  toStoreSettings,
  withPostgresStoreTransaction,
} from "./modules/store/index";

export {
  createPostgresDevelopmentResetPlan,
  getPostgresMigrationStatus,
  PostgresMigrationCommandFailure,
  readPostgresLocalMigrations,
  requirePostgresDevelopmentResetConfirmation,
  resetPostgresDevelopmentDatabase,
  resolvePostgresMigrationCommandConfig,
  rollbackPostgresDevelopmentDatabase,
  summarizePostgresMigrationStatus,
  type PostgresAppliedMigrationRow,
  type PostgresDevelopmentMigrationCommandOptions,
  type PostgresDevelopmentMigrationCommandPlan,
  type PostgresLocalMigrationRecord,
  type PostgresMigrationCommand,
  type PostgresMigrationCommandPhase,
  type PostgresMigrationConfigResolved,
  type PostgresMigrationRecordStatus,
  type PostgresMigrationStatusRecord,
  type PostgresMigrationStatusResult,
} from "./migration-commands";

export {
  buildPostgresOutboxInsert,
  createPostgresOutboxLayer,
  PostgresOutboxLayer,
  postgresOutboxClaimLockClause,
  toEnqueuedOutboxRecord,
  toStoredOutboxRecord,
  type PostgresOutboxLayerOptions,
} from "./outbox";

export {
  CurrentPostgresTransactionService,
  createPostgresDrizzleLayer,
  PostgresDrizzleService,
  type PostgresDrizzleConfig,
  type PostgresDrizzleDatabase,
  type PostgresDrizzleService as PostgresDrizzleServiceShape,
  type PostgresDrizzleTransaction,
} from "./postgres-drizzle";

/**
 * PostgreSQL adapter package. It composes `@effect/sql-pg` with Drizzle's
 * Effect PostgreSQL driver while keeping concrete database types outside core.
 */
export const postgresAdapterPackage = "@ecommerce/db-postgres" as const;

/** PostgreSQL type OIDs that Drizzle should receive as raw strings. */
export const drizzleRawTextTypeOids = [
  1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182,
] as const;

/** Effect SQL PostgreSQL pool configuration accepted by the adapter Layer. */
export type PostgresPoolConfig = PgClient.PgPoolConfig;

/** Effect PostgreSQL client service type exposed by the adapter package. */
export type EffectPostgresClient = PgClient.PgClient;

/**
 * Creates pg type parsers that leave date/time-ish PostgreSQL values as raw
 * text so Drizzle's PostgreSQL codecs own value normalization.
 */
export const createDrizzlePgTypes = (
  fallbackTypes: CustomTypesConfig = pgTypes
): CustomTypesConfig => ({
  getTypeParser: (typeId, format) => {
    if (typeof typeId === "number" && isDrizzleRawTextTypeOid(typeId)) {
      return (value: string) => value;
    }

    return fallbackTypes.getTypeParser(typeId, format);
  },
});

const isDrizzleRawTextTypeOid = (typeId: number): boolean =>
  drizzleRawTextTypeOids.some((rawTypeId) => rawTypeId === typeId);

/** Adds Drizzle-safe pg parsers to an Effect SQL PostgreSQL pool config. */
export const withDrizzlePgTypes = (
  config: PostgresPoolConfig
): PostgresPoolConfig => ({
  ...config,
  types: createDrizzlePgTypes(config.types),
});

/** Creates a redacted URL-based PostgreSQL pool config for composition roots. */
export const createPostgresPoolConfig = ({
  url,
  ...config
}: Omit<PostgresPoolConfig, "url"> & {
  readonly url: Redacted.Redacted | string;
}): PostgresPoolConfig => ({
  ...config,
  url: typeof url === "string" ? Redacted.make(url) : url,
});

/** Creates the scoped Effect SQL PostgreSQL client Layer. */
export const createPostgresClientLayer = (config: PostgresPoolConfig) =>
  PgClient.layer(withDrizzlePgTypes(config));

/** Creates the full PostgreSQL adapter Layer used by runtime composition roots. */
export const createPostgresDatabaseLayer = ({
  drizzle,
  postgres,
}: {
  readonly drizzle?: PostgresDrizzleConfig;
  readonly postgres: PostgresPoolConfig;
}) =>
  createPostgresDrizzleLayer(drizzle).pipe(
    Layer.provide(createPostgresClientLayer(postgres))
  );

/** Runs the checked-in Drizzle PostgreSQL migrations through Effect. */
export const runPostgresMigrations = (
  options?: PostgresMigrationRunnerOptions
) =>
  PostgresDrizzleService.use((service) =>
    PgDrizzleMigrator.migrate(
      service.database,
      createPostgresMigrationConfig(options)
    )
  );
