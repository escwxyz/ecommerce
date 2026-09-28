import {
  EffectHttpAuthMiddleware,
  EffectHttpExecutionMiddleware,
  EffectHttpForbidden,
  EffectHttpRequestContextMiddleware,
} from "@ecommerce/api/effect-http-middleware";
import { createApiSuccessSchema } from "@ecommerce/api/http-api-schemas";
import {
  RepositoryConflict,
  RepositoryDecodeFailure,
  RepositoryUnavailable,
} from "@ecommerce/core";
import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import {
  CreateCustomerAddressInputSchema,
  CreateCustomerGroupInputSchema,
  CreateCustomerInputSchema,
  CustomerAuthUserConflict,
  CustomerApiGroupSchema,
  CustomerApiListSchema,
  CustomerApiProfileSchema,
  CustomerEmailConflict,
  CustomerGroupAssignmentInputSchema,
  CustomerGroupNotFound,
  CustomerIdentifierSchema,
  CustomerInvalidIdentifier,
  CustomerNotFound,
  CustomerPaymentIdentitySchema,
  LinkCustomerAuthInputSchema,
  ResolveCustomerFromAuthInputSchema,
  UpdateCustomerProfileInputSchema,
} from "../domain";

const customerDomainErrors = [
  CustomerAuthUserConflict.pipe(HttpApiSchema.status(409)),
  CustomerEmailConflict.pipe(HttpApiSchema.status(409)),
  CustomerGroupNotFound.pipe(HttpApiSchema.status(404)),
  CustomerInvalidIdentifier.pipe(HttpApiSchema.status(400)),
  CustomerNotFound.pipe(HttpApiSchema.status(404)),
] as const;

const customerPersistenceErrors = [
  RepositoryConflict.pipe(HttpApiSchema.status(409)),
  RepositoryDecodeFailure.pipe(HttpApiSchema.status(503)),
  RepositoryUnavailable.pipe(HttpApiSchema.status(503)),
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const customerReadErrors = [
  EffectHttpForbidden,
  ...customerDomainErrors,
  ...customerPersistenceErrors,
] as const;

/** Declared HTTP error schemas for this module contract surface. */
export const customerWriteErrors = [
  EffectHttpForbidden,
  ...customerDomainErrors,
  ...customerPersistenceErrors,
] as const;

/** Success envelope schema exported for contract-only API consumers. */
export const CustomerApiProfileSuccessSchema = createApiSuccessSchema(
  CustomerApiProfileSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const CustomerApiNullableProfileSuccessSchema = createApiSuccessSchema(
  Schema.NullOr(CustomerApiProfileSchema)
);
/** Success envelope schema exported for contract-only API consumers. */
export const CustomerApiListSuccessSchema = createApiSuccessSchema(
  CustomerApiListSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const CustomerApiGroupSuccessSchema = createApiSuccessSchema(
  CustomerApiGroupSchema
);
/** Success envelope schema exported for contract-only API consumers. */
export const CustomerPaymentIdentitySuccessSchema = createApiSuccessSchema(
  Schema.NullOr(CustomerPaymentIdentitySchema)
);

const customerAdminGroupIdentifier = "customerAdmin";

/** Customer admin Effect HTTP contract for commerce-management operations. */
export const customerAdminHttpApiGroup = HttpApiGroup.make(
  customerAdminGroupIdentifier
)
  .add(
    HttpApiEndpoint.post("customerCreate", "/admin/customers", {
      error: customerWriteErrors,
      payload: CreateCustomerInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerGet", "/admin/customers/get", {
      error: customerReadErrors,
      payload: CustomerIdentifierSchema,
      success: CustomerApiNullableProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.get("customerList", "/admin/customers", {
      error: customerReadErrors,
      success: CustomerApiListSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch("customerProfileUpdate", "/admin/customers", {
      error: customerWriteErrors,
      payload: UpdateCustomerProfileInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerAddressCreate", "/admin/customer-addresses", {
      error: customerWriteErrors,
      payload: CreateCustomerAddressInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post("customerGroupCreate", "/admin/customer-groups", {
      error: customerWriteErrors,
      payload: CreateCustomerGroupInputSchema,
      success: CustomerApiGroupSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "customerGroupAssign",
      "/admin/customer-groups/assign",
      {
        error: customerWriteErrors,
        payload: CustomerGroupAssignmentInputSchema,
        success: CustomerApiProfileSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post("customerAuthLink", "/admin/customers/auth-link", {
      error: customerWriteErrors,
      payload: LinkCustomerAuthInputSchema,
      success: CustomerApiProfileSuccessSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      "customerResolveFromAuth",
      "/admin/customers/resolve-auth",
      {
        error: customerReadErrors,
        payload: ResolveCustomerFromAuthInputSchema,
        success: CustomerApiNullableProfileSuccessSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      "customerPaymentIdentityGet",
      "/admin/customers/payment-identity",
      {
        error: customerReadErrors,
        payload: CustomerIdentifierSchema,
        success: CustomerPaymentIdentitySuccessSchema,
      }
    )
  )
  .middleware(EffectHttpExecutionMiddleware)
  .middleware(EffectHttpAuthMiddleware)
  .middleware(EffectHttpRequestContextMiddleware);
