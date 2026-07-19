import {
  CurrencyCodeSchema,
  CurrencySerializedIdSchema,
  MoneyAmountSerializedIdSchema,
  PriceListSerializedIdSchema,
  PriceListStatusSchema,
  PricePreferenceSerializedIdSchema,
  PriceRuleSerializedIdSchema,
  PriceSetSerializedIdSchema,
  PricingMetadataSchema,
  PricingRuleAttributesSchema,
  PricingTrimmedStringSchema,
} from "@ecommerce/pricing";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const postgresPricingCurrencyTableName = "pricing_currency" as const;
export const postgresPricingPriceSetTableName = "pricing_price_set" as const;
export const postgresPricingPriceListTableName = "pricing_price_list" as const;
export const postgresPricingMoneyAmountTableName =
  "pricing_money_amount" as const;
export const postgresPricingPriceRuleTableName = "pricing_price_rule" as const;
export const postgresPricingPricePreferenceTableName =
  "pricing_price_preference" as const;

export const postgresPricingCurrency = pgTable(
  postgresPricingCurrencyTableName,
  {
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    precision: integer("precision").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("pricing_currency_code_idx").on(table.code),
    index("pricing_currency_created_at_idx").on(table.createdAt),
  ]
);

export const postgresPricingPriceSet = pgTable(
  postgresPricingPriceSetTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof PricingMetadataSchema.Type>()
      .notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("pricing_price_set_created_at_idx").on(table.createdAt)]
);

export const postgresPricingPriceList = pgTable(
  postgresPricingPriceListTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    description: text("description"),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    id: text("id").primaryKey(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("pricing_price_list_created_at_idx").on(table.createdAt),
    index("pricing_price_list_status_idx").on(table.status),
  ]
);

export const postgresPricingMoneyAmount = pgTable(
  postgresPricingMoneyAmountTableName,
  {
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => postgresPricingCurrency.code, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    priceListId: text("price_list_id").references(
      () => postgresPricingPriceList.id,
      { onDelete: "set null" }
    ),
    priceSetId: text("price_set_id")
      .notNull()
      .references(() => postgresPricingPriceSet.id, { onDelete: "cascade" }),
    rulesJson: jsonb("rules_json")
      .$type<typeof PricingRuleAttributesSchema.Type>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("pricing_money_amount_price_set_idx").on(table.priceSetId),
    index("pricing_money_amount_currency_idx").on(table.currencyCode),
  ]
);

export const postgresPricingPriceRule = pgTable(
  postgresPricingPriceRuleTableName,
  {
    attribute: text("attribute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    priceListId: text("price_list_id")
      .notNull()
      .references(() => postgresPricingPriceList.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("pricing_price_rule_price_list_idx").on(table.priceListId)]
);

export const postgresPricingPricePreference = pgTable(
  postgresPricingPricePreferenceTableName,
  {
    attribute: text("attribute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => postgresPricingCurrency.code, { onDelete: "restrict" }),
    id: text("id").primaryKey(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index("pricing_price_preference_scope_idx").on(
      table.attribute,
      table.value
    ),
  ]
);

export const PricingCurrencyPostgresRowSchema = createSelectSchema(
  postgresPricingCurrency,
  {
    code: () => CurrencyCodeSchema,
    id: () => CurrencySerializedIdSchema,
    name: () => PricingTrimmedStringSchema,
  }
);
export const PricingCurrencyPostgresInsertSchema = createInsertSchema(
  postgresPricingCurrency,
  {
    code: () => CurrencyCodeSchema,
    id: () => CurrencySerializedIdSchema,
    name: () => PricingTrimmedStringSchema,
  }
);

export const PricingPriceSetPostgresRowSchema = createSelectSchema(
  postgresPricingPriceSet,
  {
    id: () => PriceSetSerializedIdSchema,
    metadataJson: () => PricingMetadataSchema,
    title: () => PricingTrimmedStringSchema,
  }
);
export const PricingPriceSetPostgresInsertSchema = createInsertSchema(
  postgresPricingPriceSet,
  {
    id: () => PriceSetSerializedIdSchema,
    metadataJson: () => PricingMetadataSchema,
    title: () => PricingTrimmedStringSchema,
  }
);
export const PricingPriceSetPostgresUpdateSchema = createUpdateSchema(
  postgresPricingPriceSet,
  {
    id: () => PriceSetSerializedIdSchema,
    metadataJson: () => PricingMetadataSchema,
    title: () => PricingTrimmedStringSchema,
  }
);

export const PricingPriceListPostgresRowSchema = createSelectSchema(
  postgresPricingPriceList,
  {
    description: () => PricingTrimmedStringSchema,
    id: () => PriceListSerializedIdSchema,
    status: () => PriceListStatusSchema,
    title: () => PricingTrimmedStringSchema,
  }
);
export const PricingPriceListPostgresInsertSchema = createInsertSchema(
  postgresPricingPriceList,
  {
    description: () => PricingTrimmedStringSchema,
    id: () => PriceListSerializedIdSchema,
    status: () => PriceListStatusSchema,
    title: () => PricingTrimmedStringSchema,
  }
);

export const PricingMoneyAmountPostgresRowSchema = createSelectSchema(
  postgresPricingMoneyAmount,
  {
    currencyCode: () => CurrencyCodeSchema,
    id: () => MoneyAmountSerializedIdSchema,
    priceListId: () => PriceListSerializedIdSchema,
    priceSetId: () => PriceSetSerializedIdSchema,
    rulesJson: () => PricingRuleAttributesSchema,
  }
);
export const PricingMoneyAmountPostgresInsertSchema = createInsertSchema(
  postgresPricingMoneyAmount,
  {
    currencyCode: () => CurrencyCodeSchema,
    id: () => MoneyAmountSerializedIdSchema,
    priceListId: () => PriceListSerializedIdSchema,
    priceSetId: () => PriceSetSerializedIdSchema,
    rulesJson: () => PricingRuleAttributesSchema,
  }
);

export const PricingPriceRulePostgresRowSchema = createSelectSchema(
  postgresPricingPriceRule,
  {
    attribute: () => PricingTrimmedStringSchema,
    id: () => PriceRuleSerializedIdSchema,
    priceListId: () => PriceListSerializedIdSchema,
    value: () => PricingTrimmedStringSchema,
  }
);
export const PricingPriceRulePostgresInsertSchema = createInsertSchema(
  postgresPricingPriceRule,
  {
    attribute: () => PricingTrimmedStringSchema,
    id: () => PriceRuleSerializedIdSchema,
    priceListId: () => PriceListSerializedIdSchema,
    value: () => PricingTrimmedStringSchema,
  }
);

export const PricingPricePreferencePostgresRowSchema = createSelectSchema(
  postgresPricingPricePreference,
  {
    attribute: () => PricingTrimmedStringSchema,
    currencyCode: () => CurrencyCodeSchema,
    id: () => PricePreferenceSerializedIdSchema,
    value: () => PricingTrimmedStringSchema,
  }
);
export const PricingPricePreferencePostgresInsertSchema = createInsertSchema(
  postgresPricingPricePreference,
  {
    attribute: () => PricingTrimmedStringSchema,
    currencyCode: () => CurrencyCodeSchema,
    id: () => PricePreferenceSerializedIdSchema,
    value: () => PricingTrimmedStringSchema,
  }
);

export type PricingCurrencyPostgresRow =
  typeof PricingCurrencyPostgresRowSchema.Type;
export type PricingCurrencyPostgresInsert =
  typeof PricingCurrencyPostgresInsertSchema.Type;
export type PricingPriceSetPostgresRow =
  typeof PricingPriceSetPostgresRowSchema.Type;
export type PricingPriceSetPostgresInsert =
  typeof PricingPriceSetPostgresInsertSchema.Type;
export type PricingPriceSetPostgresUpdate =
  typeof PricingPriceSetPostgresUpdateSchema.Type;
export type PricingPriceListPostgresRow =
  typeof PricingPriceListPostgresRowSchema.Type;
export type PricingPriceListPostgresInsert =
  typeof PricingPriceListPostgresInsertSchema.Type;
export type PricingMoneyAmountPostgresRow =
  typeof PricingMoneyAmountPostgresRowSchema.Type;
export type PricingMoneyAmountPostgresInsert =
  typeof PricingMoneyAmountPostgresInsertSchema.Type;
export type PricingPriceRulePostgresRow =
  typeof PricingPriceRulePostgresRowSchema.Type;
export type PricingPriceRulePostgresInsert =
  typeof PricingPriceRulePostgresInsertSchema.Type;
export type PricingPricePreferencePostgresRow =
  typeof PricingPricePreferencePostgresRowSchema.Type;
export type PricingPricePreferencePostgresInsert =
  typeof PricingPricePreferencePostgresInsertSchema.Type;
