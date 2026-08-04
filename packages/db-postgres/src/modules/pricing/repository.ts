import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CurrencyRecordSchema,
  MoneyAmountRecordSchema,
  PriceListRecordSchema,
  PriceRuleRecordSchema,
  PriceSetRecordSchema,
  PricingRepositoryService,
  createCurrencyIdEffect,
  createMoneyAmountIdEffect,
  createPriceListIdEffect,
  createPriceRuleIdEffect,
  createPriceSetIdEffect,
} from "@ecommerce/pricing";
import type {
  CurrencyRecord,
  MoneyAmountRecord,
  PriceListRecord,
  PricePreferenceRecord,
  PriceRuleRecord,
  PriceSetId,
  PriceSetRecord,
  PricingExpectedError,
  PricingRepository,
} from "@ecommerce/pricing";
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
  PricingCurrencyPostgresInsertSchema,
  PricingCurrencyPostgresRowSchema,
  PricingMoneyAmountPostgresInsertSchema,
  PricingMoneyAmountPostgresRowSchema,
  PricingPriceListPostgresInsertSchema,
  PricingPriceListPostgresRowSchema,
  PricingPricePreferencePostgresInsertSchema,
  PricingPriceRulePostgresInsertSchema,
  PricingPriceRulePostgresRowSchema,
  PricingPriceSetPostgresInsertSchema,
  PricingPriceSetPostgresRowSchema,
  postgresPricingCurrency,
  postgresPricingMoneyAmount,
  postgresPricingPriceList,
  postgresPricingPricePreference,
  postgresPricingPriceRule,
  postgresPricingPriceSet,
} from "./schema";
import type {
  PricingCurrencyPostgresInsert,
  PricingCurrencyPostgresRow,
  PricingMoneyAmountPostgresInsert,
  PricingMoneyAmountPostgresRow,
  PricingPriceListPostgresInsert,
  PricingPriceListPostgresRow,
  PricingPricePreferencePostgresInsert,
  PricingPriceRulePostgresInsert,
  PricingPriceRulePostgresRow,
  PricingPriceSetPostgresInsert,
  PricingPriceSetPostgresRow,
} from "./schema";

type PricingPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const pricingRepositoryName = "PricingRepository";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: pricingRepositoryName,
    });

const toRepositoryDecodeFailure = (
  entity:
    | "currency"
    | "money-amount"
    | "price-list"
    | "price-preference"
    | "price-rule"
    | "price-set",
  operation: "read" | "write"
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: pricingRepositoryName,
  });

const getPricingExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<PricingPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toPricingCurrencyPostgresInsert = (
  currency: CurrencyRecord
): EffectValue<PricingCurrencyPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingCurrencyPostgresInsertSchema)({
    code: currency.code,
    createdAt: currency.createdAt,
    id: currency.id,
    name: currency.name,
    precision: currency.precision,
    updatedAt: currency.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("currency", "write"))
  );

export const toPricingPriceSetPostgresInsert = (
  priceSet: PriceSetRecord
): EffectValue<PricingPriceSetPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingPriceSetPostgresInsertSchema)({
    createdAt: priceSet.createdAt,
    id: priceSet.id,
    metadataJson: priceSet.metadata,
    title: priceSet.title,
    updatedAt: priceSet.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-set", "write"))
  );

export const toPricingPriceListPostgresInsert = (
  priceList: PriceListRecord
): EffectValue<PricingPriceListPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingPriceListPostgresInsertSchema)({
    createdAt: priceList.createdAt,
    description: priceList.description,
    endsAt: priceList.endsAt,
    id: priceList.id,
    startsAt: priceList.startsAt,
    status: priceList.status,
    title: priceList.title,
    updatedAt: priceList.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-list", "write"))
  );

export const toPricingMoneyAmountPostgresInsert = (
  amount: MoneyAmountRecord
): EffectValue<PricingMoneyAmountPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingMoneyAmountPostgresInsertSchema)({
    amount: amount.amount,
    createdAt: amount.createdAt,
    currencyCode: amount.currencyCode,
    id: amount.id,
    priceListId: amount.priceListId,
    priceSetId: amount.priceSetId,
    rulesJson: amount.rules,
    updatedAt: amount.updatedAt,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("money-amount", "write"))
  );

export const toPricingPriceRulePostgresInsert = (
  rule: PriceRuleRecord
): EffectValue<PricingPriceRulePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingPriceRulePostgresInsertSchema)({
    attribute: rule.attribute,
    createdAt: rule.createdAt,
    id: rule.id,
    priceListId: rule.priceListId,
    updatedAt: rule.updatedAt,
    value: rule.value,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-rule", "write"))
  );

export const toPricingPricePreferencePostgresInsert = (
  preference: PricePreferenceRecord
): EffectValue<PricingPricePreferencePostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(PricingPricePreferencePostgresInsertSchema)({
    attribute: preference.attribute,
    createdAt: preference.createdAt,
    currencyCode: preference.currencyCode,
    id: preference.id,
    updatedAt: preference.updatedAt,
    value: preference.value,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("price-preference", "write")
    )
  );

const toCurrencyRecord = (
  row: PricingCurrencyPostgresRow
): EffectValue<CurrencyRecord, PricingExpectedError> =>
  Effect.gen(function* toCurrencyRecordEffect() {
    const id = yield* createCurrencyIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CurrencyRecordSchema)({
      code: row.code,
      createdAt: row.createdAt,
      id,
      name: row.name,
      precision: row.precision,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("currency", "read"))
    );
  });

const toPriceSetRecord = (
  row: PricingPriceSetPostgresRow
): EffectValue<PriceSetRecord, PricingExpectedError> =>
  Effect.gen(function* toPriceSetRecordEffect() {
    const id = yield* createPriceSetIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(PriceSetRecordSchema)({
      createdAt: row.createdAt,
      id,
      metadata: row.metadataJson,
      title: row.title,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("price-set", "read"))
    );
  });

const toPriceListRecord = (
  row: PricingPriceListPostgresRow
): EffectValue<PriceListRecord, PricingExpectedError> =>
  Effect.gen(function* toPriceListRecordEffect() {
    const id = yield* createPriceListIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(PriceListRecordSchema)({
      createdAt: row.createdAt,
      description: row.description,
      endsAt: row.endsAt,
      id,
      startsAt: row.startsAt,
      status: row.status,
      title: row.title,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("price-list", "read"))
    );
  });

const toMoneyAmountRecord = (
  row: PricingMoneyAmountPostgresRow
): EffectValue<MoneyAmountRecord, PricingExpectedError> =>
  Effect.gen(function* toMoneyAmountRecordEffect() {
    const id = yield* createMoneyAmountIdEffect(row.id);
    const priceSetId = yield* createPriceSetIdEffect(row.priceSetId);
    const priceListId = row.priceListId
      ? yield* createPriceListIdEffect(row.priceListId)
      : null;

    return yield* Schema.decodeUnknownEffect(MoneyAmountRecordSchema)({
      amount: row.amount,
      createdAt: row.createdAt,
      currencyCode: row.currencyCode,
      id,
      priceListId,
      priceSetId,
      rules: row.rulesJson,
      updatedAt: row.updatedAt,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("money-amount", "read"))
    );
  });

const toPriceRuleRecord = (
  row: PricingPriceRulePostgresRow
): EffectValue<PriceRuleRecord, PricingExpectedError> =>
  Effect.gen(function* toPriceRuleRecordEffect() {
    const id = yield* createPriceRuleIdEffect(row.id);
    const priceListId = yield* createPriceListIdEffect(row.priceListId);

    return yield* Schema.decodeUnknownEffect(PriceRuleRecordSchema)({
      attribute: row.attribute,
      createdAt: row.createdAt,
      id,
      priceListId,
      updatedAt: row.updatedAt,
      value: row.value,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("price-rule", "read"))
    );
  });

const decodeCurrencyRow = (
  row: unknown
): EffectValue<CurrencyRecord, PricingExpectedError> =>
  Schema.decodeUnknownEffect(PricingCurrencyPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("currency", "read")),
    Effect.flatMap(toCurrencyRecord)
  );

const decodePriceSetRow = (
  row: unknown
): EffectValue<PriceSetRecord, PricingExpectedError> =>
  Schema.decodeUnknownEffect(PricingPriceSetPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-set", "read")),
    Effect.flatMap(toPriceSetRecord)
  );

const decodePriceListRow = (
  row: unknown
): EffectValue<PriceListRecord, PricingExpectedError> =>
  Schema.decodeUnknownEffect(PricingPriceListPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-list", "read")),
    Effect.flatMap(toPriceListRecord)
  );

const decodeMoneyAmountRow = (
  row: unknown
): EffectValue<MoneyAmountRecord, PricingExpectedError> =>
  Schema.decodeUnknownEffect(PricingMoneyAmountPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("money-amount", "read")),
    Effect.flatMap(toMoneyAmountRecord)
  );

const decodePriceRuleRow = (
  row: unknown
): EffectValue<PriceRuleRecord, PricingExpectedError> =>
  Schema.decodeUnknownEffect(PricingPriceRulePostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("price-rule", "read")),
    Effect.flatMap(toPriceRuleRecord)
  );

export const createPostgresPricingRepository = (
  service: PostgresDrizzleServiceShape
): PricingRepository =>
  PricingRepositoryService.of({
    findCurrencyByCode: (code) =>
      Effect.gen(function* findCurrencyByCodeEffect() {
        const executor = yield* getPricingExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresPricingCurrency)
          .where(eq(postgresPricingCurrency.code, code))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodeCurrencyRow(row) : null;
      }),
    findMoneyAmountsForPriceSet: (priceSetId: PriceSetId) =>
      Effect.gen(function* findMoneyAmountsForPriceSetEffect() {
        const executor = yield* getPricingExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresPricingMoneyAmount)
          .where(eq(postgresPricingMoneyAmount.priceSetId, priceSetId))
          .orderBy(desc(postgresPricingMoneyAmount.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return yield* Effect.all(rows.map(decodeMoneyAmountRow));
      }),
    findPriceListById: (id) =>
      Effect.gen(function* findPriceListByIdEffect() {
        const executor = yield* getPricingExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresPricingPriceList)
          .where(eq(postgresPricingPriceList.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodePriceListRow(row) : null;
      }),
    findPriceRulesByPriceListId: (priceListId) =>
      Effect.gen(function* findPriceRulesByPriceListIdEffect() {
        const executor = yield* getPricingExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresPricingPriceRule)
          .where(eq(postgresPricingPriceRule.priceListId, priceListId))
          .orderBy(desc(postgresPricingPriceRule.createdAt))
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return yield* Effect.all(rows.map(decodePriceRuleRow));
      }),
    findPriceSetById: (id) =>
      Effect.gen(function* findPriceSetByIdEffect() {
        const executor = yield* getPricingExecutor(service);
        const [row] = yield* executor
          .select()
          .from(postgresPricingPriceSet)
          .where(eq(postgresPricingPriceSet.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        return row ? yield* decodePriceSetRow(row) : null;
      }),
    listCurrencies: Effect.gen(function* listCurrenciesEffect() {
      const executor = yield* getPricingExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresPricingCurrency)
        .orderBy(desc(postgresPricingCurrency.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map(decodeCurrencyRow));
    }),
    saveCurrency: (currency) =>
      Effect.gen(function* saveCurrencyEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert = yield* toPricingCurrencyPostgresInsert(currency);
        yield* executor
          .insert(postgresPricingCurrency)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingCurrency.code,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return currency;
      }),
    saveMoneyAmount: (amount) =>
      Effect.gen(function* saveMoneyAmountEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert = yield* toPricingMoneyAmountPostgresInsert(amount);
        yield* executor
          .insert(postgresPricingMoneyAmount)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingMoneyAmount.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return amount;
      }),
    savePriceList: (priceList) =>
      Effect.gen(function* savePriceListEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert = yield* toPricingPriceListPostgresInsert(priceList);
        yield* executor
          .insert(postgresPricingPriceList)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingPriceList.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return priceList;
      }),
    savePricePreference: (preference) =>
      Effect.gen(function* savePricePreferenceEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert =
          yield* toPricingPricePreferencePostgresInsert(preference);
        yield* executor
          .insert(postgresPricingPricePreference)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingPricePreference.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return preference;
      }),
    savePriceRule: (rule) =>
      Effect.gen(function* savePriceRuleEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert = yield* toPricingPriceRulePostgresInsert(rule);
        yield* executor
          .insert(postgresPricingPriceRule)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingPriceRule.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return rule;
      }),
    savePriceSet: (priceSet) =>
      Effect.gen(function* savePriceSetEffect() {
        const executor = yield* getPricingExecutor(service);
        const insert = yield* toPricingPriceSetPostgresInsert(priceSet);
        yield* executor
          .insert(postgresPricingPriceSet)
          .values(insert)
          .onConflictDoUpdate({
            set: insert,
            target: postgresPricingPriceSet.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return priceSet;
      }),
  });

export const createPostgresPricingRepositoryLayer = () =>
  Layer.effect(
    PricingRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresPricingRepository(service))
    )
  );

/** Production PostgreSQL pricing repository Layer. */
export const PostgresPricingRepositoryLayer =
  createPostgresPricingRepositoryLayer();

/** Runs a pricing repository Effect inside the current PostgreSQL transaction. */
export const withPostgresPricingTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
