import {
  CustomerAddressKindSchema,
  CustomerEmailSchema,
  CustomerMetadataSchema,
  CustomerSerializedAddressIdSchema,
  CustomerSerializedGroupIdSchema,
  CustomerSerializedIdSchema,
  CustomerTrimmedStringSchema,
} from "@ecommerce/customer";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const postgresCustomerTableName = "customer" as const;
export const postgresCustomerAddressTableName = "customer_address" as const;
export const postgresCustomerGroupTableName = "customer_group" as const;
export const postgresCustomerGroupCustomerTableName =
  "customer_group_customer" as const;

export const postgresCustomer = pgTable(
  postgresCustomerTableName,
  {
    authUserId: text("auth_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    id: text("id").primaryKey(),
    lastName: text("last_name"),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CustomerMetadataSchema.Type>()
      .notNull(),
    phone: text("phone"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("customer_email_idx").on(table.email),
    uniqueIndex("customer_auth_user_id_idx").on(table.authUserId),
    index("customer_created_at_idx").on(table.createdAt),
  ]
);

export const postgresCustomerAddress = pgTable(
  postgresCustomerAddressTableName,
  {
    address1: text("address1").notNull(),
    address2: text("address2"),
    city: text("city").notNull(),
    company: text("company"),
    countryCode: text("country_code").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => postgresCustomer.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    id: text("id").primaryKey(),
    isDefaultBilling: boolean("is_default_billing").notNull(),
    isDefaultShipping: boolean("is_default_shipping").notNull(),
    kind: text("kind").notNull(),
    lastName: text("last_name"),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CustomerMetadataSchema.Type>()
      .notNull(),
    phone: text("phone"),
    postalCode: text("postal_code").notNull(),
    province: text("province"),
  },
  (table) => [index("customer_address_customer_id_idx").on(table.customerId)]
);

export const postgresCustomerGroup = pgTable(
  postgresCustomerGroupTableName,
  {
    handle: text("handle").notNull(),
    id: text("id").primaryKey(),
    metadataJson: jsonb("metadata_json")
      .$type<typeof CustomerMetadataSchema.Type>()
      .notNull(),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("customer_group_handle_idx").on(table.handle)]
);

export const postgresCustomerGroupCustomer = pgTable(
  postgresCustomerGroupCustomerTableName,
  {
    customerId: text("customer_id")
      .notNull()
      .references(() => postgresCustomer.id, { onDelete: "cascade" }),
    customerGroupId: text("customer_group_id")
      .notNull()
      .references(() => postgresCustomerGroup.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.customerId, table.customerGroupId],
    }),
    index("customer_group_customer_group_idx").on(table.customerGroupId),
  ]
);

export const CustomerPostgresRowSchema = createSelectSchema(postgresCustomer, {
  authUserId: () => CustomerTrimmedStringSchema,
  email: () => CustomerEmailSchema,
  firstName: () => CustomerTrimmedStringSchema,
  id: () => CustomerSerializedIdSchema,
  lastName: () => CustomerTrimmedStringSchema,
  metadataJson: () => CustomerMetadataSchema,
  phone: () => CustomerTrimmedStringSchema,
});

export const CustomerPostgresInsertSchema = createInsertSchema(
  postgresCustomer,
  {
    authUserId: () => CustomerTrimmedStringSchema,
    email: () => CustomerEmailSchema,
    firstName: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedIdSchema,
    lastName: () => CustomerTrimmedStringSchema,
    metadataJson: () => CustomerMetadataSchema,
    phone: () => CustomerTrimmedStringSchema,
  }
);

export const CustomerPostgresUpdateSchema = createUpdateSchema(
  postgresCustomer,
  {
    authUserId: () => CustomerTrimmedStringSchema,
    email: () => CustomerEmailSchema,
    firstName: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedIdSchema,
    lastName: () => CustomerTrimmedStringSchema,
    metadataJson: () => CustomerMetadataSchema,
    phone: () => CustomerTrimmedStringSchema,
  }
);

export const CustomerAddressPostgresRowSchema = createSelectSchema(
  postgresCustomerAddress,
  {
    address1: () => CustomerTrimmedStringSchema,
    address2: () => CustomerTrimmedStringSchema,
    city: () => CustomerTrimmedStringSchema,
    company: () => CustomerTrimmedStringSchema,
    countryCode: () => CustomerTrimmedStringSchema,
    customerId: () => CustomerSerializedIdSchema,
    firstName: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedAddressIdSchema,
    kind: () => CustomerAddressKindSchema,
    lastName: () => CustomerTrimmedStringSchema,
    metadataJson: () => CustomerMetadataSchema,
    phone: () => CustomerTrimmedStringSchema,
    postalCode: () => CustomerTrimmedStringSchema,
    province: () => CustomerTrimmedStringSchema,
  }
);

export const CustomerAddressPostgresInsertSchema = createInsertSchema(
  postgresCustomerAddress,
  {
    address1: () => CustomerTrimmedStringSchema,
    address2: () => CustomerTrimmedStringSchema,
    city: () => CustomerTrimmedStringSchema,
    company: () => CustomerTrimmedStringSchema,
    countryCode: () => CustomerTrimmedStringSchema,
    customerId: () => CustomerSerializedIdSchema,
    firstName: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedAddressIdSchema,
    kind: () => CustomerAddressKindSchema,
    lastName: () => CustomerTrimmedStringSchema,
    metadataJson: () => CustomerMetadataSchema,
    phone: () => CustomerTrimmedStringSchema,
    postalCode: () => CustomerTrimmedStringSchema,
    province: () => CustomerTrimmedStringSchema,
  }
);

export const CustomerGroupPostgresRowSchema = createSelectSchema(
  postgresCustomerGroup,
  {
    handle: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedGroupIdSchema,
    metadataJson: () => CustomerMetadataSchema,
    name: () => CustomerTrimmedStringSchema,
  }
);

export const CustomerGroupPostgresInsertSchema = createInsertSchema(
  postgresCustomerGroup,
  {
    handle: () => CustomerTrimmedStringSchema,
    id: () => CustomerSerializedGroupIdSchema,
    metadataJson: () => CustomerMetadataSchema,
    name: () => CustomerTrimmedStringSchema,
  }
);

export type CustomerPostgresRow = typeof CustomerPostgresRowSchema.Type;
export type CustomerPostgresInsert = typeof CustomerPostgresInsertSchema.Type;
export type CustomerPostgresUpdate = typeof CustomerPostgresUpdateSchema.Type;
export type CustomerAddressPostgresRow =
  typeof CustomerAddressPostgresRowSchema.Type;
export type CustomerAddressPostgresInsert =
  typeof CustomerAddressPostgresInsertSchema.Type;
export type CustomerGroupPostgresRow =
  typeof CustomerGroupPostgresRowSchema.Type;
export type CustomerGroupPostgresInsert =
  typeof CustomerGroupPostgresInsertSchema.Type;
