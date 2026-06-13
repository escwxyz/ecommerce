export { customerAdminMetadata, customerAdminSurfaces } from "./admin";
export {
  createD1CustomerRepository,
  type CreateD1CustomerRepositoryOptions,
  type CustomerD1Database,
} from "./adapters";
export { defineApiContractRoute, customerContractRouter } from "./contracts";
export {
  CUSTOMER_ADDRESS_ID_PREFIX,
  CUSTOMER_GROUP_ID_PREFIX,
  CUSTOMER_ID_PREFIX,
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerAddressKindSchema,
  CustomerAddressSchema,
  CustomerApiListSchema,
  CustomerApiProfileSchema,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupSchema,
  CustomerIdentifierSchema,
  CustomerMetadataSchema,
  CustomerPaymentIdentitySchema,
  CustomerProfileSchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
  createCustomerAddressId,
  createCustomerGroupId,
  createCustomerId,
  customerMigration,
  customerSchema,
  customerTableName,
  serializeCustomerAddressId,
  serializeCustomerGroupId,
  serializeCustomerId,
} from "./domain";
export type {
  CreateCustomerAddressInput,
  CreateCustomerGroupInput,
  CreateCustomerInput,
  CustomerAddress,
  CustomerAddressId,
  CustomerApiProfile,
  CustomerDatabase,
  CustomerDatabaseSchema,
  CustomerGroup,
  CustomerGroupId,
  CustomerId,
  CustomerInsert,
  CustomerPaymentIdentity,
  CustomerProfile,
  CustomerRepository,
  CustomerRow,
  CustomerSchemaKey,
  LinkCustomerAuthInput,
  ResolveCustomerFromAuthInput,
  UpdateCustomerProfileInput,
} from "./domain";
export { customerExtensionPoints, customerModule } from "./module";
export { customerPermissionList, customerPermissions } from "./permissions";
export {
  InMemoryCustomerRepository,
  createInMemoryCustomerRepository,
  createResettableInMemoryCustomerRepository,
  defaultCustomerRepository,
  type ResettableCustomerRepository,
} from "./repositories";
export {
  createCustomerRouteFragment,
  customerApiFragment,
  customerRouter,
  type CreateCustomerRouteFragmentOptions,
  type CustomerModuleContext,
} from "./router";
export {
  CUSTOMER_AUTH_LINKED_EVENT,
  CUSTOMER_CREATED_EVENT,
  CUSTOMER_UPDATED_EVENT,
  CustomerService,
  createCustomerService,
  createCustomerServiceLayer,
  defaultCustomerService,
  type CreateCustomerServiceOptions,
  type CustomerAuthLinkedEventPayload,
  type CustomerChangedEventPayload,
  type CustomerServiceShape,
} from "./services";
export { createTestCustomerService } from "./testing";
