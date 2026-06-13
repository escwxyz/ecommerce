import type {
  CustomerAddress,
  CustomerGroup,
  CustomerGroupId,
  CustomerId,
  CustomerProfile,
  CustomerRepository,
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

  #requireCustomer(customerId: CustomerId): CustomerProfile {
    const customer = this.#customers.get(customerId);

    if (!customer) {
      throw new Error(`Customer "${customerId}" was not found.`);
    }

    return customer;
  }

  addCustomerAddress({
    address,
    customerId,
  }: {
    readonly address: CustomerAddress;
    readonly customerId: CustomerId;
  }): Promise<CustomerProfile> {
    const customer = this.#requireCustomer(customerId);
    const updated = {
      ...customer,
      addresses: [...customer.addresses, address],
    };

    this.#customers.set(customerId, updated);
    return Promise.resolve(updated);
  }

  assignCustomerGroup({
    customerId,
    groupId,
  }: {
    readonly customerId: CustomerId;
    readonly groupId: CustomerGroupId;
  }): Promise<CustomerProfile> {
    const customer = this.#requireCustomer(customerId);

    if (!this.#groups.has(groupId)) {
      throw new Error(`Customer group "${groupId}" was not found.`);
    }

    if (customer.groupIds.includes(groupId)) {
      return Promise.resolve(customer);
    }

    const updated = {
      ...customer,
      groupIds: [...customer.groupIds, groupId],
    };

    this.#customers.set(customerId, updated);
    return Promise.resolve(updated);
  }

  findCustomerByAuthUserId(
    authUserId: string
  ): Promise<CustomerProfile | null> {
    for (const customer of this.#customers.values()) {
      if (customer.authUserId === authUserId) {
        return Promise.resolve(customer);
      }
    }

    return Promise.resolve(null);
  }

  findCustomerByEmail(email: string): Promise<CustomerProfile | null> {
    const normalizedEmail = email.toLowerCase();

    for (const customer of this.#customers.values()) {
      if (customer.email.toLowerCase() === normalizedEmail) {
        return Promise.resolve(customer);
      }
    }

    return Promise.resolve(null);
  }

  findCustomerById(id: CustomerId): Promise<CustomerProfile | null> {
    return Promise.resolve(this.#customers.get(id) ?? null);
  }

  findCustomerGroupById(id: CustomerGroupId): Promise<CustomerGroup | null> {
    return Promise.resolve(this.#groups.get(id) ?? null);
  }

  listCustomerGroups(): Promise<readonly CustomerGroup[]> {
    return Promise.resolve(sortGroups(this.#groups.values()));
  }

  listCustomers(): Promise<readonly CustomerProfile[]> {
    return Promise.resolve(sortCustomers(this.#customers.values()));
  }

  linkCustomerAuth({
    authUserId,
    customerId,
  }: {
    readonly authUserId: string;
    readonly customerId: CustomerId;
  }): Promise<CustomerProfile> {
    const customer = this.#requireCustomer(customerId);
    const updated = {
      ...customer,
      authUserId,
    };

    this.#customers.set(customerId, updated);
    return Promise.resolve(updated);
  }

  saveCustomer(customer: CustomerProfile): Promise<CustomerProfile> {
    this.#customers.set(customer.id, customer);
    return Promise.resolve(customer);
  }

  saveCustomerGroup(group: CustomerGroup): Promise<CustomerGroup> {
    this.#groups.set(group.id, group);
    return Promise.resolve(group);
  }

  updateCustomer(customer: CustomerProfile): Promise<CustomerProfile> {
    this.#customers.set(customer.id, customer);
    return Promise.resolve(customer);
  }
}

export const defaultCustomerRepository = new InMemoryCustomerRepository();

export const createInMemoryCustomerRepository = (): CustomerRepository =>
  new InMemoryCustomerRepository();

export const createResettableInMemoryCustomerRepository =
  (): ResettableCustomerRepository => new InMemoryCustomerRepository();
