import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { productContractRouter } from "../contracts";
import type {
  CreateProductInput,
  ProductApiRecord,
  ProductIdentifierInput,
  ProductRecord,
} from "../domain";
import { createProductId, serializeProductId } from "../domain";
import { productPermissions } from "../permissions";
import { createProductService, defaultProductService } from "../services";
import type { CreateProductServiceOptions } from "../services";

export interface ProductModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: ProductModuleContext["session"];
    }): ProductAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type ProductAuthorizationDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertPermission = (
  session: ProductModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: ProductModuleContext["authorization"]
): void => {
  const decision = authorization.evaluatePermission({ permission, session });

  if (decision.allowed) {
    return;
  }

  if (decision.reason === "missing-authenticated-actor") {
    throw new ORPCError("UNAUTHORIZED");
  }

  throw new ORPCError("FORBIDDEN");
};

const serializeProduct = (product: ProductRecord): ProductApiRecord => ({
  createdAt: product.createdAt.toISOString(),
  handle: product.handle,
  id: serializeProductId(product.id),
  status: product.status,
  title: product.title,
  updatedAt: product.updatedAt.toISOString(),
});

export interface CreateProductRouteFragmentOptions extends CreateProductServiceOptions {
  readonly key?: string;
}

export const createProductRouteFragment = ({
  key = "module:product",
  ...options
}: CreateProductRouteFragmentOptions = {}) => {
  const service =
    options.repository || options.clock || options.idGenerator
      ? createProductService(options)
      : defaultProductService;

  const baseImplementation = implement(
    productContractRouter
  ).$context<ProductModuleContext>();

  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    productCreate: protectedImplementation.productCreate.handler(
      async ({
        context,
        input,
      }: {
        readonly context: ProductModuleContext;
        readonly input: CreateProductInput;
      }) => {
        assertPermission(
          context.session,
          productPermissions.write,
          context.authorization
        );

        return serializeProduct(await service.createProductDraft(input));
      }
    ),
    productGet: protectedImplementation.productGet.handler(
      async ({
        context,
        input,
      }: {
        readonly context: ProductModuleContext;
        readonly input: ProductIdentifierInput;
      }) => {
        assertPermission(
          context.session,
          productPermissions.read,
          context.authorization
        );

        const product = await service.getProductById(createProductId(input.id));

        return product ? serializeProduct(product) : null;
      }
    ),
    productList: protectedImplementation.productList.handler(
      async ({ context }) => {
        assertPermission(
          context.session,
          productPermissions.read,
          context.authorization
        );

        const records = await service.listProducts();

        return records.map(serializeProduct);
      }
    ),
  });

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const productApiFragment = createProductRouteFragment();
export const productRouter = productApiFragment.router;
