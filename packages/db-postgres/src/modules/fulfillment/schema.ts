import {
  FulfillmentCountryCodeSchema,
  FulfillmentMetadataSchema,
  FulfillmentProviderRecordSerializedIdSchema,
  FulfillmentSerializedIdSchema,
  FulfillmentSetSerializedIdSchema,
  FulfillmentStatusSchema,
  FulfillmentTrimmedStringSchema,
  ReturnShipmentLinkSerializedIdSchema,
  ServiceZoneSerializedIdSchema,
  ShipmentRecordSerializedIdSchema,
  ShipmentStatusSchema,
  ShippingOptionSerializedIdSchema,
  ShippingProfileSerializedIdSchema,
} from "@ecommerce/fulfillment";
import {
  createInsertSchema,
  createSelectSchema,
} from "drizzle-orm/effect-schema";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Schema } from "effect";

export const postgresFulfillmentProviderTableName =
  "fulfillment_provider" as const;
export const postgresFulfillmentSetTableName = "fulfillment_set" as const;
export const postgresShippingProfileTableName = "shipping_profile" as const;
export const postgresServiceZoneTableName = "service_zone" as const;
export const postgresShippingOptionTableName = "shipping_option" as const;
export const postgresFulfillmentTableName = "fulfillment" as const;
export const postgresShipmentTableName = "shipment" as const;
export const postgresReturnShipmentLinkTableName =
  "return_shipment_link" as const;

export const postgresFulfillmentProvider = pgTable(
  postgresFulfillmentProviderTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    isEnabled: text("is_enabled").notNull(),
    providerKey: text("provider_key").notNull(),
    providerRecordId: text("provider_record_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("fulfillment_provider_key_idx").on(table.providerKey)]
);

export const postgresFulfillmentSet = pgTable(postgresFulfillmentSetTableName, {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  id: text("id").primaryKey(),
  metadataJson: jsonb("metadata_json")
    .$type<typeof FulfillmentMetadataSchema.Type>()
    .notNull(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const postgresShippingProfile = pgTable(
  postgresShippingProfileTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    fulfillmentSetId: text("fulfillment_set_id")
      .notNull()
      .references(() => postgresFulfillmentSet.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof FulfillmentMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("shipping_profile_set_idx").on(table.fulfillmentSetId)]
);

export const postgresServiceZone = pgTable(
  postgresServiceZoneTableName,
  {
    countryCodesJson: jsonb("country_codes_json")
      .$type<readonly string[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    fulfillmentSetId: text("fulfillment_set_id")
      .notNull()
      .references(() => postgresFulfillmentSet.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof FulfillmentMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    regionIdsJson: jsonb("region_ids_json")
      .$type<readonly string[]>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("service_zone_set_idx").on(table.fulfillmentSetId)]
);

export const postgresShippingOption = pgTable(
  postgresShippingOptionTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    currencyCode: text("currency_code"),
    fulfillmentSetId: text("fulfillment_set_id")
      .notNull()
      .references(() => postgresFulfillmentSet.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    isEnabled: text("is_enabled").notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof FulfillmentMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
    priceAmount: text("price_amount"),
    profileId: text("profile_id")
      .notNull()
      .references(() => postgresShippingProfile.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    providerServiceId: text("provider_service_id").notNull(),
    serviceZoneId: text("service_zone_id")
      .notNull()
      .references(() => postgresServiceZone.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("shipping_option_provider_idx").on(
      table.providerKey,
      table.providerServiceId
    ),
    index("shipping_option_set_idx").on(table.fulfillmentSetId),
  ]
);

export const postgresFulfillment = pgTable(
  postgresFulfillmentTableName,
  {
    addressJson:
      jsonb("address_json").$type<Readonly<Record<string, unknown>>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    itemsJson: jsonb("items_json").$type<readonly unknown[]>().notNull(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof FulfillmentMetadataSchema.Type>()
      .notNull(),
    orderId: text("order_id").notNull(),
    providerFulfillmentId: text("provider_fulfillment_id"),
    providerKey: text("provider_key").notNull(),
    shippingOptionId: text("shipping_option_id")
      .notNull()
      .references(() => postgresShippingOption.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("fulfillment_idempotency_idx").on(table.idempotencyKey),
    index("fulfillment_order_idx").on(table.orderId),
  ]
);

export const postgresShipment = pgTable(
  postgresShipmentTableName,
  {
    carrier: text("carrier"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    fulfillmentId: text("fulfillment_id")
      .notNull()
      .references(() => postgresFulfillment.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    labelUrl: text("label_url"),
    metadataJson: jsonb("metadata_json")
      .$type<typeof FulfillmentMetadataSchema.Type>()
      .notNull(),
    providerShipmentId: text("provider_shipment_id").notNull(),
    status: text("status").notNull(),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("shipment_fulfillment_idx").on(table.fulfillmentId)]
);

export const postgresReturnShipmentLink = pgTable(
  postgresReturnShipmentLinkTableName,
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    fulfillmentId: text("fulfillment_id")
      .notNull()
      .references(() => postgresFulfillment.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    providerReturnId: text("provider_return_id"),
    returnId: text("return_id").notNull(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => postgresShipment.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("return_shipment_fulfillment_idx").on(table.fulfillmentId)]
);

const CountryCodeArraySchema = Schema.Array(FulfillmentCountryCodeSchema);
const StringArraySchema = Schema.Array(FulfillmentTrimmedStringSchema);

export const FulfillmentProviderPostgresRowSchema = createSelectSchema(
  postgresFulfillmentProvider,
  {
    id: () => FulfillmentProviderRecordSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    providerKey: () => FulfillmentTrimmedStringSchema,
    providerRecordId: () => FulfillmentTrimmedStringSchema,
  }
);
export const FulfillmentProviderPostgresInsertSchema = createInsertSchema(
  postgresFulfillmentProvider,
  {
    id: () => FulfillmentProviderRecordSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    providerKey: () => FulfillmentTrimmedStringSchema,
    providerRecordId: () => FulfillmentTrimmedStringSchema,
  }
);

export const FulfillmentSetPostgresRowSchema = createSelectSchema(
  postgresFulfillmentSet,
  {
    id: () => FulfillmentSetSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
  }
);
export const FulfillmentSetPostgresInsertSchema = createInsertSchema(
  postgresFulfillmentSet,
  {
    id: () => FulfillmentSetSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
  }
);

export const ShippingProfilePostgresRowSchema = createSelectSchema(
  postgresShippingProfile,
  {
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ShippingProfileSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
  }
);
export const ShippingProfilePostgresInsertSchema = createInsertSchema(
  postgresShippingProfile,
  {
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ShippingProfileSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
  }
);

export const ServiceZonePostgresRowSchema = createSelectSchema(
  postgresServiceZone,
  {
    countryCodesJson: () => CountryCodeArraySchema,
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ServiceZoneSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
    regionIdsJson: () => StringArraySchema,
  }
);
export const ServiceZonePostgresInsertSchema = createInsertSchema(
  postgresServiceZone,
  {
    countryCodesJson: () => CountryCodeArraySchema,
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ServiceZoneSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
    regionIdsJson: () => StringArraySchema,
  }
);

export const ShippingOptionPostgresRowSchema = createSelectSchema(
  postgresShippingOption,
  {
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ShippingOptionSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
    priceAmount: () => Schema.NullOr(Schema.String),
    profileId: () => ShippingProfileSerializedIdSchema,
    providerKey: () => FulfillmentTrimmedStringSchema,
    providerServiceId: () => FulfillmentTrimmedStringSchema,
    serviceZoneId: () => ServiceZoneSerializedIdSchema,
  }
);
export const ShippingOptionPostgresInsertSchema = createInsertSchema(
  postgresShippingOption,
  {
    fulfillmentSetId: () => FulfillmentSetSerializedIdSchema,
    id: () => ShippingOptionSerializedIdSchema,
    isEnabled: () => Schema.Literals(["true", "false"]),
    metadataJson: () => FulfillmentMetadataSchema,
    name: () => FulfillmentTrimmedStringSchema,
    priceAmount: () => Schema.NullOr(Schema.String),
    profileId: () => ShippingProfileSerializedIdSchema,
    providerKey: () => FulfillmentTrimmedStringSchema,
    providerServiceId: () => FulfillmentTrimmedStringSchema,
    serviceZoneId: () => ServiceZoneSerializedIdSchema,
  }
);

export const FulfillmentPostgresRowSchema = createSelectSchema(
  postgresFulfillment,
  {
    id: () => FulfillmentSerializedIdSchema,
    idempotencyKey: () => FulfillmentTrimmedStringSchema,
    providerKey: () => FulfillmentTrimmedStringSchema,
    shippingOptionId: () => ShippingOptionSerializedIdSchema,
    status: () => FulfillmentStatusSchema,
  }
);
export const FulfillmentPostgresInsertSchema = createInsertSchema(
  postgresFulfillment,
  {
    id: () => FulfillmentSerializedIdSchema,
    idempotencyKey: () => FulfillmentTrimmedStringSchema,
    providerKey: () => FulfillmentTrimmedStringSchema,
    shippingOptionId: () => ShippingOptionSerializedIdSchema,
    status: () => FulfillmentStatusSchema,
  }
);

export const ShipmentPostgresRowSchema = createSelectSchema(postgresShipment, {
  fulfillmentId: () => FulfillmentSerializedIdSchema,
  id: () => ShipmentRecordSerializedIdSchema,
  metadataJson: () => FulfillmentMetadataSchema,
  providerShipmentId: () => FulfillmentTrimmedStringSchema,
  status: () => ShipmentStatusSchema,
});
export const ShipmentPostgresInsertSchema = createInsertSchema(
  postgresShipment,
  {
    fulfillmentId: () => FulfillmentSerializedIdSchema,
    id: () => ShipmentRecordSerializedIdSchema,
    metadataJson: () => FulfillmentMetadataSchema,
    providerShipmentId: () => FulfillmentTrimmedStringSchema,
    status: () => ShipmentStatusSchema,
  }
);

export const ReturnShipmentLinkPostgresRowSchema = createSelectSchema(
  postgresReturnShipmentLink,
  {
    fulfillmentId: () => FulfillmentSerializedIdSchema,
    id: () => ReturnShipmentLinkSerializedIdSchema,
    returnId: () => FulfillmentTrimmedStringSchema,
    shipmentId: () => ShipmentRecordSerializedIdSchema,
  }
);
export const ReturnShipmentLinkPostgresInsertSchema = createInsertSchema(
  postgresReturnShipmentLink,
  {
    fulfillmentId: () => FulfillmentSerializedIdSchema,
    id: () => ReturnShipmentLinkSerializedIdSchema,
    returnId: () => FulfillmentTrimmedStringSchema,
    shipmentId: () => ShipmentRecordSerializedIdSchema,
  }
);

export type FulfillmentProviderPostgresRow =
  typeof FulfillmentProviderPostgresRowSchema.Type;
export type FulfillmentSetPostgresRow =
  typeof FulfillmentSetPostgresRowSchema.Type;
export type ShippingProfilePostgresRow =
  typeof ShippingProfilePostgresRowSchema.Type;
export type ServiceZonePostgresRow = typeof ServiceZonePostgresRowSchema.Type;
export type ShippingOptionPostgresRow =
  typeof ShippingOptionPostgresRowSchema.Type;
export type FulfillmentPostgresRow = typeof FulfillmentPostgresRowSchema.Type;
export type ShipmentPostgresRow = typeof ShipmentPostgresRowSchema.Type;
export type ReturnShipmentLinkPostgresRow =
  typeof ReturnShipmentLinkPostgresRowSchema.Type;
