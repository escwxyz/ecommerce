import type { Insertable, Kysely } from "kysely";

import type {
  CustomerAddress,
  CustomerAddressRow,
  CustomerDatabase,
  CustomerGroup,
  CustomerGroupRow,
  CustomerId,
  CustomerProfile,
  CustomerRepository,
  CustomerRow,
} from "../../domain";
import {
  CustomerAddressKindSchema,
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
} from "../../domain";

export type CustomerD1Database = Kysely<CustomerDatabase>;

export interface CreateD1CustomerRepositoryOptions {
  readonly db: CustomerD1Database;
}

const parseJsonColumn = <Value>(value: string): Value => JSON.parse(value);
const toJsonColumn = (value: unknown): string => JSON.stringify(value);

const toBooleanColumn = (value: boolean): number => (value ? 1 : 0);
const fromBooleanColumn = (value: number): boolean => value === 1;

const toCustomerAddress = (row: CustomerAddressRow): CustomerAddress => ({
  address1: row.address1,
  ...(row.address2 ? { address2: row.address2 } : {}),
  city: row.city,
  ...(row.company ? { company: row.company } : {}),
  countryCode: row.country_code,
  ...(row.first_name ? { firstName: row.first_name } : {}),
  id: createCustomerAddressId(row.id),
  isDefaultBilling: fromBooleanColumn(row.is_default_billing),
  isDefaultShipping: fromBooleanColumn(row.is_default_shipping),
  kind: CustomerAddressKindSchema.parse(row.kind),
  ...(row.last_name ? { lastName: row.last_name } : {}),
  metadata: parseJsonColumn(row.metadata),
  ...(row.phone ? { phone: row.phone } : {}),
  postalCode: row.postal_code,
  ...(row.province ? { province: row.province } : {}),
});

const toCustomerGroup = (row: CustomerGroupRow): CustomerGroup => ({
  handle: row.handle,
  id: createCustomerGroupId(row.id),
  metadata: parseJsonColumn(row.metadata),
  name: row.name,
});

const toCustomerInsert = (
  customer: CustomerProfile
): Insertable<CustomerDatabase["customer"]> => ({
  auth_user_id: customer.authUserId,
  created_at: customer.createdAt.getTime(),
  email: customer.email,
  first_name: customer.firstName ?? null,
  id: customer.id,
  last_name: customer.lastName ?? null,
  metadata: toJsonColumn(customer.metadata),
  phone: customer.phone ?? null,
  updated_at: customer.updatedAt.getTime(),
});

const toCustomerAddressInsert = (
  customerId: CustomerId,
  address: CustomerAddress
): Insertable<CustomerDatabase["customer_address"]> => ({
  address1: address.address1,
  address2: address.address2 ?? null,
  city: address.city,
  company: address.company ?? null,
  country_code: address.countryCode,
  customer_id: customerId,
  first_name: address.firstName ?? null,
  id: address.id,
  is_default_billing: toBooleanColumn(address.isDefaultBilling),
  is_default_shipping: toBooleanColumn(address.isDefaultShipping),
  kind: address.kind,
  last_name: address.lastName ?? null,
  metadata: toJsonColumn(address.metadata),
  phone: address.phone ?? null,
  postal_code: address.postalCode,
  province: address.province ?? null,
});

const toCustomerGroupInsert = (
  group: CustomerGroup
): Insertable<CustomerDatabase["customer_group"]> => ({
  handle: group.handle,
  id: group.id,
  metadata: toJsonColumn(group.metadata),
  name: group.name,
});

const selectCustomerProfile = async (
  db: CustomerD1Database,
  row: CustomerRow
): Promise<CustomerProfile> => {
  const [addressRows, groupRows] = await Promise.all([
    db
      .selectFrom("customer_address")
      .selectAll()
      .where("customer_id", "=", row.id)
      .execute(),
    db
      .selectFrom("customer_group_customer")
      .select("customer_group_id")
      .where("customer_id", "=", row.id)
      .execute(),
  ]);

  return {
    addresses: addressRows.map(toCustomerAddress),
    authUserId: row.auth_user_id,
    createdAt: new Date(row.created_at),
    email: row.email,
    ...(row.first_name ? { firstName: row.first_name } : {}),
    groupIds: groupRows.map((groupRow) =>
      createCustomerGroupId(groupRow.customer_group_id)
    ),
    id: createCustomerId(row.id),
    ...(row.last_name ? { lastName: row.last_name } : {}),
    metadata: parseJsonColumn(row.metadata),
    ...(row.phone ? { phone: row.phone } : {}),
    updatedAt: new Date(row.updated_at),
  };
};

const findCustomerByColumn = async (
  db: CustomerD1Database,
  column: "auth_user_id" | "email" | "id",
  value: string
): Promise<CustomerProfile | null> => {
  const row = await db
    .selectFrom("customer")
    .selectAll()
    .where(column, "=", value)
    .executeTakeFirst();

  return row ? selectCustomerProfile(db, row) : null;
};

const replaceCustomerAddresses = async (
  db: CustomerD1Database,
  customer: CustomerProfile
): Promise<void> => {
  await db
    .deleteFrom("customer_address")
    .where("customer_id", "=", customer.id)
    .execute();

  if (customer.addresses.length === 0) {
    return;
  }

  await db
    .insertInto("customer_address")
    .values(
      customer.addresses.map((address) =>
        toCustomerAddressInsert(customer.id, address)
      )
    )
    .execute();
};

const replaceCustomerGroupLinks = async (
  db: CustomerD1Database,
  customer: CustomerProfile
): Promise<void> => {
  await db
    .deleteFrom("customer_group_customer")
    .where("customer_id", "=", customer.id)
    .execute();

  if (customer.groupIds.length === 0) {
    return;
  }

  await db
    .insertInto("customer_group_customer")
    .values(
      customer.groupIds.map((groupId) => ({
        customer_group_id: groupId,
        customer_id: customer.id,
      }))
    )
    .execute();
};

const persistCustomerRelations = async (
  db: CustomerD1Database,
  customer: CustomerProfile
): Promise<void> => {
  await replaceCustomerAddresses(db, customer);
  await replaceCustomerGroupLinks(db, customer);
};

const requirePersistedCustomer = async (
  db: CustomerD1Database,
  customerId: CustomerId
): Promise<CustomerProfile> => {
  const customer = await findCustomerByColumn(db, "id", customerId);

  if (!customer) {
    throw new Error(`Customer "${customerId}" was not found.`);
  }

  return customer;
};

export const createD1CustomerRepository = ({
  db,
}: CreateD1CustomerRepositoryOptions): CustomerRepository => ({
  addCustomerAddress: async ({ address, customerId }) => {
    await db
      .insertInto("customer_address")
      .values(toCustomerAddressInsert(customerId, address))
      .execute();

    return requirePersistedCustomer(db, customerId);
  },
  assignCustomerGroup: async ({ customerId, groupId }) => {
    await db
      .insertInto("customer_group_customer")
      .values({
        customer_group_id: groupId,
        customer_id: customerId,
      })
      .onConflict((conflict) =>
        conflict.columns(["customer_id", "customer_group_id"]).doNothing()
      )
      .execute();

    return requirePersistedCustomer(db, customerId);
  },
  findCustomerByAuthUserId: (authUserId) =>
    findCustomerByColumn(db, "auth_user_id", authUserId),
  findCustomerByEmail: (email) =>
    findCustomerByColumn(db, "email", email.toLowerCase()),
  findCustomerById: (id) => findCustomerByColumn(db, "id", id),
  findCustomerGroupById: async (id) => {
    const row = await db
      .selectFrom("customer_group")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toCustomerGroup(row) : null;
  },
  listCustomerGroups: async () => {
    const rows = await db
      .selectFrom("customer_group")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    return rows.map(toCustomerGroup);
  },
  listCustomers: async () => {
    const rows = await db
      .selectFrom("customer")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
    const customers: CustomerProfile[] = [];

    for (const row of rows) {
      customers.push(await selectCustomerProfile(db, row));
    }

    return customers;
  },
  linkCustomerAuth: async ({ authUserId, customerId }) => {
    await db
      .updateTable("customer")
      .set({ auth_user_id: authUserId })
      .where("id", "=", customerId)
      .execute();

    return requirePersistedCustomer(db, customerId);
  },
  saveCustomer: async (customer) => {
    await db
      .insertInto("customer")
      .values(toCustomerInsert(customer))
      .execute();
    await persistCustomerRelations(db, customer);

    return customer;
  },
  saveCustomerGroup: async (group) => {
    const values = toCustomerGroupInsert(group);

    await db
      .insertInto("customer_group")
      .values(values)
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          handle: values.handle,
          metadata: values.metadata,
          name: values.name,
        })
      )
      .execute();

    return group;
  },
  updateCustomer: async (customer) => {
    const values = toCustomerInsert(customer);

    await db
      .updateTable("customer")
      .set({
        auth_user_id: values.auth_user_id,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        metadata: values.metadata,
        phone: values.phone,
        updated_at: values.updated_at,
      })
      .where("id", "=", customer.id)
      .execute();
    await persistCustomerRelations(db, customer);

    return customer;
  },
});
