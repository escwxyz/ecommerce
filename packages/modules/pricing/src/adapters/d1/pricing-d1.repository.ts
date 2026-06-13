import type { Kysely } from "kysely";

import type {
  CurrencyRecord,
  CurrencyRow,
  MoneyAmountRecord,
  MoneyAmountRow,
  PriceListRecord,
  PriceListRow,
  PriceRuleRecord,
  PriceRuleRow,
  PriceSetRecord,
  PriceSetRow,
  PricingDatabase,
  PricingRepository,
} from "../../domain";
import {
  createCurrencyId,
  createMoneyAmountId,
  createPriceListId,
  createPriceRuleId,
  createPriceSetId,
} from "../../domain";

export type PricingD1Database = Kysely<PricingDatabase>;

export interface CreateD1PricingRepositoryOptions {
  readonly db: PricingD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const toCurrencyRecord = (row: CurrencyRow): CurrencyRecord => ({
  code: row.code,
  createdAt: new Date(row.created_at),
  id: createCurrencyId(row.id),
  name: row.name,
  precision: row.precision,
  updatedAt: new Date(row.updated_at),
});

const toPriceSetRecord = (row: PriceSetRow): PriceSetRecord => ({
  createdAt: new Date(row.created_at),
  id: createPriceSetId(row.id),
  metadata: parseJsonColumn(row.metadata_json),
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

const toPriceListRecord = (row: PriceListRow): PriceListRecord => ({
  createdAt: new Date(row.created_at),
  description: row.description,
  endsAt: row.ends_at === null ? null : new Date(row.ends_at),
  id: createPriceListId(row.id),
  startsAt: row.starts_at === null ? null : new Date(row.starts_at),
  status: row.status as PriceListRecord["status"],
  title: row.title,
  updatedAt: new Date(row.updated_at),
});

const toMoneyAmountRecord = (row: MoneyAmountRow): MoneyAmountRecord => ({
  amount: row.amount,
  createdAt: new Date(row.created_at),
  currencyCode: row.currency_code,
  id: createMoneyAmountId(row.id),
  priceListId:
    row.price_list_id === null ? null : createPriceListId(row.price_list_id),
  priceSetId: createPriceSetId(row.price_set_id),
  rules: parseJsonColumn(row.rules_json),
  updatedAt: new Date(row.updated_at),
});

const toPriceRuleRecord = (row: PriceRuleRow): PriceRuleRecord => ({
  attribute: row.attribute,
  createdAt: new Date(row.created_at),
  id: createPriceRuleId(row.id),
  priceListId: createPriceListId(row.price_list_id),
  updatedAt: new Date(row.updated_at),
  value: row.value,
});

export const createD1PricingRepository = ({
  db,
}: CreateD1PricingRepositoryOptions): PricingRepository => ({
  findCurrencyByCode: async (code) => {
    const row = await db
      .selectFrom("pricing_currency")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    return row ? toCurrencyRecord(row) : null;
  },
  findMoneyAmountsForPriceSet: async (priceSetId) => {
    const rows = await db
      .selectFrom("pricing_money_amount")
      .selectAll()
      .where("price_set_id", "=", priceSetId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toMoneyAmountRecord);
  },
  findPriceListById: async (id) => {
    const row = await db
      .selectFrom("pricing_price_list")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toPriceListRecord(row) : null;
  },
  findPriceRulesByPriceListId: async (priceListId) => {
    const rows = await db
      .selectFrom("pricing_price_rule")
      .selectAll()
      .where("price_list_id", "=", priceListId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toPriceRuleRecord);
  },
  findPriceSetById: async (id) => {
    const row = await db
      .selectFrom("pricing_price_set")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toPriceSetRecord(row) : null;
  },
  listCurrencies: async () => {
    const rows = await db
      .selectFrom("pricing_currency")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toCurrencyRecord);
  },
  saveCurrency: async (currency) => {
    const values = {
      code: currency.code,
      created_at: currency.createdAt.getTime(),
      id: currency.id,
      name: currency.name,
      precision: currency.precision,
      updated_at: currency.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("pricing_currency")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("code").doUpdateSet({
          created_at: values.created_at,
          id: values.id,
          name: values.name,
          precision: values.precision,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return currency;
  },
  saveMoneyAmount: async (amount) => {
    const values = {
      amount: amount.amount,
      created_at: amount.createdAt.getTime(),
      currency_code: amount.currencyCode,
      id: amount.id,
      price_list_id: amount.priceListId,
      price_set_id: amount.priceSetId,
      rules_json: toJsonColumn(amount.rules),
      updated_at: amount.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("pricing_money_amount")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          amount: values.amount,
          created_at: values.created_at,
          currency_code: values.currency_code,
          price_list_id: values.price_list_id,
          price_set_id: values.price_set_id,
          rules_json: values.rules_json,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return amount;
  },
  savePriceList: async (priceList) => {
    const values = {
      created_at: priceList.createdAt.getTime(),
      description: priceList.description,
      ends_at: priceList.endsAt?.getTime() ?? null,
      id: priceList.id,
      starts_at: priceList.startsAt?.getTime() ?? null,
      status: priceList.status,
      title: priceList.title,
      updated_at: priceList.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("pricing_price_list")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: values.created_at,
          description: values.description,
          ends_at: values.ends_at,
          starts_at: values.starts_at,
          status: values.status,
          title: values.title,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return priceList;
  },
  savePricePreference: async (preference) => {
    const values = {
      attribute: preference.attribute,
      created_at: preference.createdAt.getTime(),
      currency_code: preference.currencyCode,
      id: preference.id,
      updated_at: preference.updatedAt.getTime(),
      value: preference.value,
    } as const;

    await db
      .insertInto("pricing_price_preference")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          attribute: values.attribute,
          created_at: values.created_at,
          currency_code: values.currency_code,
          updated_at: values.updated_at,
          value: values.value,
        })
      )
      .execute();

    return preference;
  },
  savePriceRule: async (rule) => {
    const values = {
      attribute: rule.attribute,
      created_at: rule.createdAt.getTime(),
      id: rule.id,
      price_list_id: rule.priceListId,
      updated_at: rule.updatedAt.getTime(),
      value: rule.value,
    } as const;

    await db
      .insertInto("pricing_price_rule")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          attribute: values.attribute,
          created_at: values.created_at,
          price_list_id: values.price_list_id,
          updated_at: values.updated_at,
          value: values.value,
        })
      )
      .execute();

    return rule;
  },
  savePriceSet: async (priceSet) => {
    const values = {
      created_at: priceSet.createdAt.getTime(),
      id: priceSet.id,
      metadata_json: toJsonColumn(priceSet.metadata),
      title: priceSet.title,
      updated_at: priceSet.updatedAt.getTime(),
    } as const;

    await db
      .insertInto("pricing_price_set")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          created_at: values.created_at,
          metadata_json: values.metadata_json,
          title: values.title,
          updated_at: values.updated_at,
        })
      )
      .execute();

    return priceSet;
  },
});
