import { Effect, Layer } from "effect";

import type {
  CustomerAddress,
  CustomerExpectedError,
  CustomerGroup,
  CustomerGroupId,
  CustomerId,
  CustomerProfile,
  CustomerRepository,
} from "../domain";
import {
  CustomerGroupNotFound,
  CustomerNotFound,
  CustomerRepositoryService,
} from "../domain";

export interface ResettableCustomerRepository extends CustomerRepository {
  clear(): void;
}

const sortCustomers = (
  records: Iterable<CustomerProfile>
): CustomerProfile[] => {
  const sortedCustomers: CustomerProfile[] = [];

  for (const record of records) {
    const recordTimestamp = record.createdAt.getTime();
    let insertAt = 0;

    while (insertAt < sortedCustomers.length) {
      const currentCustomer = sortedCustomers[insertAt];

      if (!currentCustomer) {
        break;
      }

      if (currentCustomer.createdAt.getTime() < recordTimestamp) {
        break;
      }

      insertAt += 1;
    }

    sortedCustomers.splice(insertAt, 0, record);
  }

  return sortedCustomers;
};

const sortGroups = (records: Iterable<CustomerGroup>): CustomerGroup[] => {
  const sortedGroups: CustomerGroup[] = [];

  for (const record of records) {
    let insertAt = 0;

    while (insertAt < sortedGroups.length) {
      const currentGroup = sortedGroups[insertAt];

      if (!currentGroup) {
        break;
      }

      if (record.name.localeCompare(currentGroup.name) < 0) {
        break;
      }

      insertAt += 1;
    }

    sortedGroups.splice(insertAt, 0, record);
  }

  return sortedGroups;
};

export class InMemoryCustomerRepository implements ResettableCustomerRepository {
  readonly #customers = new Map<string, CustomerProfile>();
  readonly #groups = new Map<string, CustomerGroup>();

  clear(): void {
    this.#customers.clear();
    this.#groups.clear();
  }

  #requireCustomer(
    customerId: CustomerId
  ): Effect.Effect<CustomerProfile, CustomerExpectedError> {
    const customer = this.#customers.get(customerId);

    if (!customer) {
      return Effect.fail(new CustomerNotFound({ customerId }));
    }

    return Effect.succeed(customer);
  }

  addCustomerAddress({
    address,
    customerId,
  }: {
    readonly address: CustomerAddress;
    readonly customerId: CustomerId;
  }) {
    return this.#requireCustomer(customerId).pipe(
      Effect.map((customer) => {
        const updated = {
          ...customer,
          addresses: [...customer.addresses, address],
        };

        this.#customers.set(customerId, updated);
        return updated;
      })
    );
  }

  assignCustomerGroup({
    customerId,
    groupId,
  }: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }) {
    return this.#requireCustomer(customerId).pipe(
      Effect.flatMap((customer) => {
        if (!this.#groups.has(groupId)) {
          return Effect.fail(new CustomerGroupNotFound({ groupId }));
        }

        if (customer.groupIds.includes(groupId)) {
          return Effect.succeed(customer);
        }

        const updated = {
          ...customer,
          groupIds: [...customer.groupIds, groupId],
        };

        this.#customers.set(customerId, updated);
        return Effect.succeed(updated);
      })
    );
  }

  findCustomerByAuthUserId(authUserId: string) {
    for (const customer of this.#customers.values()) {
      if (customer.authUserId === authUserId) {
        return Effect.succeed(customer);
      }
    }

    return Effect.succeed(null);
  }

  findCustomerByEmail(email: string) {
    const normalizedEmail = email.toLowerCase();

    for (const customer of this.#customers.values()) {
      if (customer.email.toLowerCase() === normalizedEmail) {
        return Effect.succeed(customer);
      }
    }

    return Effect.succeed(null);
  }

  findCustomerById(id: CustomerId) {
    return Effect.succeed(this.#customers.get(id) ?? null);
  }

  findCustomerGroupById(id: CustomerGroupId) {
    return Effect.succeed(this.#groups.get(id) ?? null);
  }

  readonly listCustomerGroups = Effect.sync(() =>
    sortGroups(this.#groups.values())
  );

  readonly listCustomers = Effect.sync(() =>
    sortCustomers(this.#customers.values())
  );

  linkCustomerAuth({
    authUserId,
    customerId,
  }: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }) {
    return this.#requireCustomer(customerId).pipe(
      Effect.map((customer) => {
        const updated = {
          ...customer,
          authUserId,
        };

        this.#customers.set(customerId, updated);
        return updated;
      })
    );
  }

  saveCustomer(customer: CustomerProfile) {
    return Effect.sync(() => {
      this.#customers.set(customer.id, customer);
      return customer;
    });
  }

  saveCustomerGroup(group: CustomerGroup) {
    return Effect.sync(() => {
      this.#groups.set(group.id, group);
      return group;
    });
  }

  updateCustomer(customer: CustomerProfile) {
    return Effect.sync(() => {
      this.#customers.set(customer.id, customer);
      return customer;
    });
  }
}

export const defaultCustomerRepository = new InMemoryCustomerRepository();

export const createInMemoryCustomerRepository = (): CustomerRepository =>
  new InMemoryCustomerRepository();

export const createResettableInMemoryCustomerRepository =
  (): ResettableCustomerRepository => new InMemoryCustomerRepository();

export const createInMemoryCustomerRepositoryLayer = () =>
  Layer.effect(
    CustomerRepositoryService,
    Effect.sync(() => new InMemoryCustomerRepository() as CustomerRepository)
  );
