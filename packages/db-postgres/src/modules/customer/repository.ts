import {
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import {
  CustomerAddressSchema,
  CustomerGroupNotFound,
  CustomerGroupSchema,
  CustomerProfileSchema,
  CustomerRepositoryService,
  createCustomerAddressIdEffect,
  createCustomerGroupIdEffect,
  createCustomerIdEffect,
} from "@ecommerce/customer";
import type {
  CustomerAddress,
  CustomerExpectedError,
  CustomerGroup,
  CustomerId,
  CustomerProfile,
  CustomerRepository,
} from "@ecommerce/customer";
import { asc, desc, eq } from "drizzle-orm";
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
  CustomerAddressPostgresInsertSchema,
  CustomerAddressPostgresRowSchema,
  CustomerGroupPostgresInsertSchema,
  CustomerGroupPostgresRowSchema,
  CustomerPostgresInsertSchema,
  CustomerPostgresRowSchema,
  postgresCustomer,
  postgresCustomerAddress,
  postgresCustomerGroup,
  postgresCustomerGroupCustomer,
} from "./schema";
import type {
  CustomerAddressPostgresInsert,
  CustomerAddressPostgresRow,
  CustomerGroupPostgresInsert,
  CustomerGroupPostgresRow,
  CustomerPostgresInsert,
  CustomerPostgresRow,
} from "./schema";

type CustomerPostgresExecutor =
  | PostgresDrizzleDatabase
  | PostgresDrizzleTransaction;

const customerRepositoryName = "CustomerRepository";
const customerEntityName = "customer";

const toRepositoryUnavailable =
  (operation: "delete" | "read" | "write") => (): RepositoryUnavailable =>
    new RepositoryUnavailable({
      adapter: "effect-postgres",
      operation,
      repository: customerRepositoryName,
    });

const toRepositoryDecodeFailure = (
  operation: "read" | "write",
  entity = customerEntityName
): RepositoryDecodeFailure =>
  new RepositoryDecodeFailure({
    entity,
    operation,
    repository: customerRepositoryName,
  });

const getCustomerExecutor = (
  service: PostgresDrizzleServiceShape
): EffectValue<CustomerPostgresExecutor> =>
  Effect.map(
    Effect.serviceOption(CurrentPostgresTransactionService),
    Option.getOrElse(() => service.database)
  );

export const toCustomerPostgresInsert = (
  customer: CustomerProfile
): EffectValue<CustomerPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CustomerPostgresInsertSchema)({
    authUserId: customer.authUserId,
    createdAt: customer.createdAt,
    email: customer.email,
    firstName: customer.firstName,
    id: customer.id,
    lastName: customer.lastName,
    metadataJson: customer.metadata,
    phone: customer.phone,
    updatedAt: customer.updatedAt,
  }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("write")));

export const toCustomerAddressPostgresInsert = ({
  address,
  customerId,
}: {
  readonly address: CustomerAddress;
  readonly customerId: CustomerId;
}): EffectValue<CustomerAddressPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CustomerAddressPostgresInsertSchema)({
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    company: address.company,
    countryCode: address.countryCode,
    customerId,
    firstName: address.firstName,
    id: address.id,
    isDefaultBilling: address.isDefaultBilling,
    isDefaultShipping: address.isDefaultShipping,
    kind: address.kind,
    lastName: address.lastName,
    metadataJson: address.metadata,
    phone: address.phone,
    postalCode: address.postalCode,
    province: address.province,
  }).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("write", "customer_address")
    )
  );

export const toCustomerGroupPostgresInsert = (
  group: CustomerGroup
): EffectValue<CustomerGroupPostgresInsert, RepositoryDecodeFailure> =>
  Schema.decodeUnknownEffect(CustomerGroupPostgresInsertSchema)({
    handle: group.handle,
    id: group.id,
    metadataJson: group.metadata,
    name: group.name,
  }).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("write", "customer_group"))
  );

const toCustomerAddress = (
  row: CustomerAddressPostgresRow
): EffectValue<CustomerAddress, CustomerExpectedError> =>
  Effect.gen(function* toCustomerAddressEffect() {
    const id = yield* createCustomerAddressIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CustomerAddressSchema)({
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      company: row.company,
      countryCode: row.countryCode,
      firstName: row.firstName,
      id,
      isDefaultBilling: row.isDefaultBilling,
      isDefaultShipping: row.isDefaultShipping,
      kind: row.kind,
      lastName: row.lastName,
      metadata: row.metadataJson,
      phone: row.phone,
      postalCode: row.postalCode,
      province: row.province,
    }).pipe(
      Effect.mapError(() =>
        toRepositoryDecodeFailure("read", "customer_address")
      )
    );
  });

export const toCustomerGroup = (
  row: CustomerGroupPostgresRow
): EffectValue<CustomerGroup, CustomerExpectedError> =>
  Effect.gen(function* toCustomerGroupEffect() {
    const id = yield* createCustomerGroupIdEffect(row.id);

    return yield* Schema.decodeUnknownEffect(CustomerGroupSchema)({
      handle: row.handle,
      id,
      metadata: row.metadataJson,
      name: row.name,
    }).pipe(
      Effect.mapError(() => toRepositoryDecodeFailure("read", "customer_group"))
    );
  });

const decodeCustomerAddressRow = (
  row: unknown
): EffectValue<CustomerAddress, CustomerExpectedError> =>
  Schema.decodeUnknownEffect(CustomerAddressPostgresRowSchema)(row).pipe(
    Effect.mapError(() =>
      toRepositoryDecodeFailure("read", "customer_address")
    ),
    Effect.flatMap(toCustomerAddress)
  );

const decodeCustomerGroupRow = (
  row: unknown
): EffectValue<CustomerGroup, CustomerExpectedError> =>
  Schema.decodeUnknownEffect(CustomerGroupPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("read", "customer_group")),
    Effect.flatMap(toCustomerGroup)
  );

const selectCustomerProfile = ({
  executor,
  row,
}: {
  readonly executor: CustomerPostgresExecutor;
  readonly row: CustomerPostgresRow;
}): EffectValue<CustomerProfile, CustomerExpectedError> =>
  Effect.gen(function* selectCustomerProfileEffect() {
    const customerId = yield* createCustomerIdEffect(row.id);
    const addressRows = yield* executor
      .select()
      .from(postgresCustomerAddress)
      .where(eq(postgresCustomerAddress.customerId, row.id))
      .orderBy(asc(postgresCustomerAddress.id))
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const groupRows = yield* executor
      .select()
      .from(postgresCustomerGroupCustomer)
      .where(eq(postgresCustomerGroupCustomer.customerId, row.id))
      .orderBy(asc(postgresCustomerGroupCustomer.customerGroupId))
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const addresses = yield* Effect.all(
      addressRows.map((addressRow) => decodeCustomerAddressRow(addressRow))
    );
    const groupIds = yield* Effect.all(
      groupRows.map((groupRow) =>
        createCustomerGroupIdEffect(groupRow.customerGroupId)
      )
    );

    return yield* Schema.decodeUnknownEffect(CustomerProfileSchema)({
      addresses,
      authUserId: row.authUserId,
      createdAt: row.createdAt,
      email: row.email,
      firstName: row.firstName,
      groupIds,
      id: customerId,
      lastName: row.lastName,
      metadata: row.metadataJson,
      phone: row.phone,
      updatedAt: row.updatedAt,
    }).pipe(Effect.mapError(() => toRepositoryDecodeFailure("read")));
  });

const decodeCustomerProfile = ({
  executor,
  row,
}: {
  readonly executor: CustomerPostgresExecutor;
  readonly row: unknown;
}): EffectValue<CustomerProfile, CustomerExpectedError> =>
  Schema.decodeUnknownEffect(CustomerPostgresRowSchema)(row).pipe(
    Effect.mapError(() => toRepositoryDecodeFailure("read")),
    Effect.flatMap((decoded) =>
      selectCustomerProfile({ executor, row: decoded })
    )
  );

const findCustomerByColumn = ({
  column,
  service,
  value,
}: {
  readonly column:
    | typeof postgresCustomer.authUserId
    | typeof postgresCustomer.email
    | typeof postgresCustomer.id;
  readonly service: PostgresDrizzleServiceShape;
  readonly value: string;
}): EffectValue<CustomerProfile | null, CustomerExpectedError> =>
  Effect.gen(function* findCustomerByColumnEffect() {
    const executor = yield* getCustomerExecutor(service);
    const row = yield* executor
      .select()
      .from(postgresCustomer)
      .where(eq(column, value))
      .limit(1)
      .pipe(Effect.mapError(toRepositoryUnavailable("read")));
    const [first] = row;

    if (!first) {
      return null;
    }

    return yield* decodeCustomerProfile({ executor, row: first });
  });

const requirePersistedCustomer = ({
  customerId,
  service,
}: {
  readonly customerId: CustomerId;
  readonly service: PostgresDrizzleServiceShape;
}): EffectValue<CustomerProfile, CustomerExpectedError> =>
  findCustomerByColumn({
    column: postgresCustomer.id,
    service,
    value: customerId,
  }).pipe(
    Effect.flatMap((customer) =>
      customer
        ? Effect.succeed(customer)
        : Effect.fail(toRepositoryUnavailable("read")())
    )
  );

const replaceCustomerRelations = ({
  customer,
  executor,
}: {
  readonly customer: CustomerProfile;
  readonly executor: CustomerPostgresExecutor;
}): EffectValue<void, CustomerExpectedError> =>
  Effect.gen(function* replaceCustomerRelationsEffect() {
    yield* executor
      .delete(postgresCustomerAddress)
      .where(eq(postgresCustomerAddress.customerId, customer.id))
      .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("delete")));
    yield* executor
      .delete(postgresCustomerGroupCustomer)
      .where(eq(postgresCustomerGroupCustomer.customerId, customer.id))
      .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("delete")));

    const addressInserts = yield* Effect.all(
      customer.addresses.map((address) =>
        toCustomerAddressPostgresInsert({
          address,
          customerId: customer.id,
        })
      )
    );
    if (addressInserts.length > 0) {
      yield* executor
        .insert(postgresCustomerAddress)
        .values(addressInserts)
        .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("write")));
    }

    if (customer.groupIds.length > 0) {
      yield* executor
        .insert(postgresCustomerGroupCustomer)
        .values(
          customer.groupIds.map((groupId) => ({
            customerGroupId: groupId,
            customerId: customer.id,
          }))
        )
        .onConflictDoNothing()
        .pipe(Effect.asVoid, Effect.mapError(toRepositoryUnavailable("write")));
    }
  });

export const createPostgresCustomerRepository = (
  service: PostgresDrizzleServiceShape
): CustomerRepository =>
  CustomerRepositoryService.of({
    addCustomerAddress: ({ address, customerId }) =>
      Effect.gen(function* addCustomerAddressEffect() {
        const executor = yield* getCustomerExecutor(service);
        const insert = yield* toCustomerAddressPostgresInsert({
          address,
          customerId,
        });
        yield* executor
          .insert(postgresCustomerAddress)
          .values(insert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return yield* requirePersistedCustomer({ customerId, service });
      }),
    assignCustomerGroup: ({ customerId, groupId }) =>
      Effect.gen(function* assignCustomerGroupEffect() {
        const executor = yield* getCustomerExecutor(service);
        const group = yield* executor
          .select()
          .from(postgresCustomerGroup)
          .where(eq(postgresCustomerGroup.id, groupId))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));

        if (!group[0]) {
          return yield* Effect.fail(new CustomerGroupNotFound({ groupId }));
        }

        yield* executor
          .insert(postgresCustomerGroupCustomer)
          .values({
            customerGroupId: groupId,
            customerId,
          })
          .onConflictDoNothing()
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return yield* requirePersistedCustomer({ customerId, service });
      }),
    findCustomerByAuthUserId: (authUserId) =>
      findCustomerByColumn({
        column: postgresCustomer.authUserId,
        service,
        value: authUserId,
      }),
    findCustomerByEmail: (email) =>
      findCustomerByColumn({
        column: postgresCustomer.email,
        service,
        value: email.toLowerCase(),
      }),
    findCustomerById: (id) =>
      findCustomerByColumn({
        column: postgresCustomer.id,
        service,
        value: id,
      }),
    findCustomerGroupById: (id) =>
      Effect.gen(function* findCustomerGroupByIdEffect() {
        const executor = yield* getCustomerExecutor(service);
        const rows = yield* executor
          .select()
          .from(postgresCustomerGroup)
          .where(eq(postgresCustomerGroup.id, id))
          .limit(1)
          .pipe(Effect.mapError(toRepositoryUnavailable("read")));
        const [row] = rows;

        return row ? yield* decodeCustomerGroupRow(row) : null;
      }),
    listCustomerGroups: Effect.gen(function* listCustomerGroupsEffect() {
      const executor = yield* getCustomerExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresCustomerGroup)
        .orderBy(asc(postgresCustomerGroup.name))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(rows.map((row) => decodeCustomerGroupRow(row)));
    }),
    listCustomers: Effect.gen(function* listCustomersEffect() {
      const executor = yield* getCustomerExecutor(service);
      const rows = yield* executor
        .select()
        .from(postgresCustomer)
        .orderBy(desc(postgresCustomer.createdAt))
        .pipe(Effect.mapError(toRepositoryUnavailable("read")));

      return yield* Effect.all(
        rows.map((row) => decodeCustomerProfile({ executor, row }))
      );
    }),
    linkCustomerAuth: ({ authUserId, customerId }) =>
      Effect.gen(function* linkCustomerAuthEffect() {
        const executor = yield* getCustomerExecutor(service);
        yield* executor
          .update(postgresCustomer)
          .set({ authUserId })
          .where(eq(postgresCustomer.id, customerId))
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return yield* requirePersistedCustomer({ customerId, service });
      }),
    saveCustomer: (customer) =>
      Effect.gen(function* saveCustomerEffect() {
        const executor = yield* getCustomerExecutor(service);
        const insert = yield* toCustomerPostgresInsert(customer);

        yield* executor
          .insert(postgresCustomer)
          .values(insert)
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );
        yield* replaceCustomerRelations({ customer, executor });

        return customer;
      }),
    saveCustomerGroup: (group) =>
      Effect.gen(function* saveCustomerGroupEffect() {
        const executor = yield* getCustomerExecutor(service);
        const insert = yield* toCustomerGroupPostgresInsert(group);
        yield* executor
          .insert(postgresCustomerGroup)
          .values(insert)
          .onConflictDoUpdate({
            set: {
              handle: insert.handle,
              metadataJson: insert.metadataJson,
              name: insert.name,
            },
            target: postgresCustomerGroup.id,
          })
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );

        return group;
      }),
    updateCustomer: (customer) =>
      Effect.gen(function* updateCustomerEffect() {
        const executor = yield* getCustomerExecutor(service);
        const insert = yield* toCustomerPostgresInsert(customer);
        yield* executor
          .update(postgresCustomer)
          .set({
            authUserId: insert.authUserId,
            email: insert.email,
            firstName: insert.firstName,
            lastName: insert.lastName,
            metadataJson: insert.metadataJson,
            phone: insert.phone,
            updatedAt: insert.updatedAt,
          })
          .where(eq(postgresCustomer.id, customer.id))
          .pipe(
            Effect.asVoid,
            Effect.mapError(toRepositoryUnavailable("write"))
          );
        yield* replaceCustomerRelations({ customer, executor });

        return customer;
      }),
  });

export const createPostgresCustomerRepositoryLayer = () =>
  Layer.effect(
    CustomerRepositoryService,
    PostgresDrizzleService.use((service) =>
      Effect.succeed(createPostgresCustomerRepository(service))
    )
  );

export const PostgresCustomerRepositoryLayer =
  createPostgresCustomerRepositoryLayer();

export const withPostgresCustomerTransaction = <A, E, R>(
  effect: EffectValue<A, E, R>
): EffectValue<A, E | SqlError, R | PostgresDrizzleService> =>
  PostgresDrizzleService.use((service) =>
    service.withTransaction(() => effect)
  );
