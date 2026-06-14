import type { AuthSession } from "@ecommerce/auth";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { paymentContractRouter } from "../contracts";
import type {
  AuthorizePaymentSessionInput,
  CapturePaymentInput,
  CreatePaymentAccountHolderInput,
  CreatePaymentCollectionInput,
  CreatePaymentSessionInput,
  Payment,
  PaymentAccountHolder,
  PaymentCapture,
  PaymentCollection,
  PaymentCollectionDetail,
  PaymentMethod,
  PaymentRefund,
  PaymentSession,
  RefundPaymentInput,
} from "../domain";
import {
  createPaymentCollectionId,
  serializePaymentAccountHolderId,
  serializePaymentCaptureId,
  serializePaymentCollectionId,
  serializePaymentId,
  serializePaymentMethodId,
  serializePaymentRefundId,
  serializePaymentSessionId,
} from "../domain";
import { paymentPermissions } from "../permissions";
import { createPaymentService, defaultPaymentService } from "../services";
import type { CreatePaymentServiceOptions } from "../services";

export interface PaymentModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: AuthSession;
    }): PaymentAuthorizationDecision;
  };
  readonly session: AuthSession;
}

type PaymentAuthorizationDecision =
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
  session: PaymentModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: PaymentModuleContext["authorization"]
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

const serializeAccountHolder = (record: PaymentAccountHolder) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentAccountHolderId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeMethod = (record: PaymentMethod) => ({
  ...record,
  accountHolderId: record.accountHolderId
    ? serializePaymentAccountHolderId(record.accountHolderId)
    : undefined,
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentMethodId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeCollection = (record: PaymentCollection) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentCollectionId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeSession = (record: PaymentSession) => ({
  ...record,
  collectionId: serializePaymentCollectionId(record.collectionId),
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentSessionId(record.id),
  updatedAt: record.updatedAt.toISOString(),
});

const serializePayment = (record: Payment) => ({
  ...record,
  collectionId: serializePaymentCollectionId(record.collectionId),
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentId(record.id),
  sessionId: serializePaymentSessionId(record.sessionId),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeCapture = (record: PaymentCapture) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentCaptureId(record.id),
  paymentId: serializePaymentId(record.paymentId),
});

const serializeRefund = (record: PaymentRefund) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  id: serializePaymentRefundId(record.id),
  paymentId: serializePaymentId(record.paymentId),
});

const serializeDetail = (detail: PaymentCollectionDetail) => ({
  ...serializeCollection(detail.collection),
  payments: detail.payments.map(serializePayment),
  sessions: detail.sessions.map(serializeSession),
});

export interface CreatePaymentRouteFragmentOptions extends CreatePaymentServiceOptions {
  readonly key?: string;
}

export const createPaymentRouteFragment = ({
  key = "module:payment",
  ...options
}: CreatePaymentRouteFragmentOptions = {}) => {
  const service =
    options.repository ||
    options.clock ||
    options.idGenerator ||
    options.providerRegistry
      ? createPaymentService(options)
      : defaultPaymentService;
  const baseImplementation = implement(
    paymentContractRouter
  ).$context<PaymentModuleContext>();
  const protectedImplementation = baseImplementation.use(
    ({ context, next }) => {
      if (!context.session?.user) {
        throw new ORPCError("UNAUTHORIZED");
      }

      return next({
        context: {
          auth: context.auth,
          authorization: context.authorization,
          session: context.session,
        },
      });
    }
  );

  const router = protectedImplementation.router({
    paymentAccountHolderCreate:
      protectedImplementation.paymentAccountHolderCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            paymentPermissions.write,
            context.authorization
          );

          return serializeAccountHolder(
            await service.createAccountHolder(
              input as CreatePaymentAccountHolderInput
            )
          );
        }
      ),
    paymentAuthorizeSession:
      protectedImplementation.paymentAuthorizeSession.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            paymentPermissions.write,
            context.authorization
          );

          return serializePayment(
            await service.authorizePaymentSession(
              input as AuthorizePaymentSessionInput
            )
          );
        }
      ),
    paymentCapture: protectedImplementation.paymentCapture.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.write,
          context.authorization
        );

        return serializeCapture(
          await service.capturePayment(input as CapturePaymentInput)
        );
      }
    ),
    paymentCollectionCreate:
      protectedImplementation.paymentCollectionCreate.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            paymentPermissions.write,
            context.authorization
          );

          const collection = await service.createCollection(
            input as CreatePaymentCollectionInput
          );
          const detail = await service.getCollectionDetail(collection.id);

          if (!detail) {
            throw new ORPCError("INTERNAL_SERVER_ERROR");
          }

          return serializeDetail(detail);
        }
      ),
    paymentCollectionGet: protectedImplementation.paymentCollectionGet.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.read,
          context.authorization
        );

        const detail = await service.getCollectionDetail(
          createPaymentCollectionId(input.id)
        );

        return detail ? serializeDetail(detail) : null;
      }
    ),
    paymentCollectionList:
      protectedImplementation.paymentCollectionList.handler(
        async ({ context }) => {
          assertPermission(
            context.session,
            paymentPermissions.read,
            context.authorization
          );

          const collections = await service.listCollections();
          return collections.map(serializeCollection);
        }
      ),
    paymentMethodAttach: protectedImplementation.paymentMethodAttach.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.write,
          context.authorization
        );

        return serializeMethod(await service.attachPaymentMethod(input));
      }
    ),
    paymentRefund: protectedImplementation.paymentRefund.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.write,
          context.authorization
        );

        return serializeRefund(
          await service.refundPayment(input as RefundPaymentInput)
        );
      }
    ),
    paymentSessionCreate: protectedImplementation.paymentSessionCreate.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.write,
          context.authorization
        );

        return serializeSession(
          await service.createSession(input as CreatePaymentSessionInput)
        );
      }
    ),
    paymentWebhookParse: protectedImplementation.paymentWebhookParse.handler(
      ({ context, input }) => {
        assertPermission(
          context.session,
          paymentPermissions.write,
          context.authorization
        );

        return service.parseProviderWebhook(input);
      }
    ),
  });

  return {
    key,
    router,
  };
};

export const paymentApiFragment = createPaymentRouteFragment();
