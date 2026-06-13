import type {
  ColumnType,
  Insertable,
  Kysely,
  Migration,
  Selectable,
} from "kysely";

export const customerTableName = "customer" as const;
export const customerAddressTableName = "customer_address" as const;
export const customerGroupTableName = "customer_group" as const;
export const customerGroupCustomerTableName =
  "customer_group_customer" as const;
export const customerEmailIndexName = "customer_email_idx" as const;
export const customerAuthUserIndexName = "customer_auth_user_id_idx" as const;
export const customerAddressCustomerIndexName =
  "customer_address_customer_id_idx" as const;
export const customerGroupHandleIndexName =
  "customer_group_handle_idx" as const;

type TimestampMsColumn = ColumnType<number, number, number>;

export interface CustomerTable {
  auth_user_id: string | null;
  created_at: TimestampMsColumn;
  email: string;
  first_name: string | null;
  id: string;
  last_name: string | null;
  metadata: string;
  phone: string | null;
  updated_at: TimestampMsColumn;
}

export interface CustomerAddressTable {
  address1: string;
  address2: string | null;
  city: string;
  company: string | null;
  country_code: string;
  customer_id: string;
  first_name: string | null;
  id: string;
  is_default_billing: number;
  is_default_shipping: number;
  kind: string;
  last_name: string | null;
  metadata: string;
  phone: string | null;
  postal_code: string;
  province: string | null;
}

export interface CustomerGroupTable {
  handle: string;
  id: string;
  metadata: string;
  name: string;
}

export interface CustomerGroupCustomerTable {
  customer_group_id: string;
  customer_id: string;
}

export interface CustomerDatabase {
  customer: CustomerTable;
  customer_address: CustomerAddressTable;
  customer_group: CustomerGroupTable;
  customer_group_customer: CustomerGroupCustomerTable;
}

export const customerSchema = {
  customer: customerTableName,
  customerAddress: customerAddressTableName,
  customerGroup: customerGroupTableName,
  customerGroupCustomer: customerGroupCustomerTableName,
} as const;

export type CustomerRow = Selectable<CustomerTable>;
export type CustomerAddressRow = Selectable<CustomerAddressTable>;
export type CustomerGroupRow = Selectable<CustomerGroupTable>;
export type CustomerInsert = Insertable<CustomerTable>;
export type CustomerDatabaseSchema = CustomerDatabase;
export type CustomerSchemaKey = keyof CustomerDatabase;

export const customerMigration: Migration = {
  down: async (db: Kysely<unknown>) => {
    await db.schema
      .dropTable(customerGroupCustomerTableName)
      .ifExists()
      .execute();
    await db.schema.dropTable(customerAddressTableName).ifExists().execute();
    await db.schema.dropTable(customerGroupTableName).ifExists().execute();
    await db.schema.dropTable(customerTableName).ifExists().execute();
  },
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable(customerTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("email", "text", (column) => column.notNull())
      .addColumn("first_name", "text")
      .addColumn("last_name", "text")
      .addColumn("phone", "text")
      .addColumn("auth_user_id", "text")
      .addColumn("metadata", "text", (column) => column.notNull())
      .addColumn("created_at", "integer", (column) => column.notNull())
      .addColumn("updated_at", "integer", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(customerEmailIndexName)
      .ifNotExists()
      .unique()
      .on(customerTableName)
      .column("email")
      .execute();

    await db.schema
      .createIndex(customerAuthUserIndexName)
      .ifNotExists()
      .unique()
      .on(customerTableName)
      .column("auth_user_id")
      .execute();

    await db.schema
      .createTable(customerAddressTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("customer_id", "text", (column) =>
        column
          .notNull()
          .references(`${customerTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("kind", "text", (column) => column.notNull())
      .addColumn("first_name", "text")
      .addColumn("last_name", "text")
      .addColumn("company", "text")
      .addColumn("address1", "text", (column) => column.notNull())
      .addColumn("address2", "text")
      .addColumn("city", "text", (column) => column.notNull())
      .addColumn("province", "text")
      .addColumn("postal_code", "text", (column) => column.notNull())
      .addColumn("country_code", "text", (column) => column.notNull())
      .addColumn("phone", "text")
      .addColumn("is_default_billing", "integer", (column) => column.notNull())
      .addColumn("is_default_shipping", "integer", (column) => column.notNull())
      .addColumn("metadata", "text", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(customerAddressCustomerIndexName)
      .ifNotExists()
      .on(customerAddressTableName)
      .column("customer_id")
      .execute();

    await db.schema
      .createTable(customerGroupTableName)
      .ifNotExists()
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("handle", "text", (column) => column.notNull())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("metadata", "text", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex(customerGroupHandleIndexName)
      .ifNotExists()
      .unique()
      .on(customerGroupTableName)
      .column("handle")
      .execute();

    await db.schema
      .createTable(customerGroupCustomerTableName)
      .ifNotExists()
      .addColumn("customer_id", "text", (column) =>
        column
          .notNull()
          .references(`${customerTableName}.id`)
          .onDelete("cascade")
      )
      .addColumn("customer_group_id", "text", (column) =>
        column
          .notNull()
          .references(`${customerGroupTableName}.id`)
          .onDelete("cascade")
      )
      .addPrimaryKeyConstraint("customer_group_customer_pk", [
        "customer_id",
        "customer_group_id",
      ])
      .execute();
  },
};
