import type { CommerceModuleApiFragment } from "@ecommerce/core";
import type { CommercePermissionDescriptor } from "@ecommerce/core/permissions";
import { implement, ORPCError } from "@orpc/server";

import { notificationEventContractRouter } from "../contracts";
import type {
  EventDeadLetterRecord,
  EventOutboxRecord,
  EventPublishResult,
  NotificationDispatchRecord,
} from "../domain";
import { notificationEventPermissions } from "../permissions";
import {
  createNotificationEventService,
  defaultNotificationEventService,
} from "../services";
import type { CreateNotificationEventServiceOptions } from "../services";

export interface NotificationEventModuleContext {
  readonly auth: unknown;
  readonly authorization: {
    evaluatePermission(input: {
      readonly permission: CommercePermissionDescriptor;
      readonly session: NotificationEventModuleContext["session"];
    }): NotificationEventAuthorizationDecision;
  };
  readonly session: {
    readonly user?: unknown | null;
  } | null;
}

type NotificationEventAuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-authenticated-actor"
        | "missing-permission"
        | "unsupported-permission";
    };

const assertPermission = (
  session: NotificationEventModuleContext["session"],
  permission: CommercePermissionDescriptor,
  authorization: NotificationEventModuleContext["authorization"]
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

const serializeOutbox = (record: EventOutboxRecord) => ({
  attempts: record.attempts,
  availableAt: record.availableAt.toISOString(),
  createdAt: record.createdAt.toISOString(),
  eventId: record.eventId,
  id: record.id,
  lastError: record.lastError,
  status: record.status,
  updatedAt: record.updatedAt.toISOString(),
});

const serializeEnvelope = (result: EventPublishResult) => ({
  envelope: {
    ...result.envelope,
    emittedAt: result.envelope.emittedAt.toISOString(),
  },
  outbox: serializeOutbox(result.outbox),
});

const serializeDispatch = (record: NotificationDispatchRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  deliveredAt: record.deliveredAt?.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeDeadLetter = (record: EventDeadLetterRecord) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
});

export interface CreateNotificationEventRouteFragmentOptions extends CreateNotificationEventServiceOptions {
  readonly key?: string;
}

export const createNotificationEventRouteFragment = ({
  key = "module:notification-event",
  ...options
}: CreateNotificationEventRouteFragmentOptions = {}) => {
  const service =
    options.clock ||
    options.idGenerator ||
    options.notificationProviders ||
    options.repository
      ? createNotificationEventService(options)
      : defaultNotificationEventService;
  const baseImplementation = implement(
    notificationEventContractRouter
  ).$context<NotificationEventModuleContext>();
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
    eventDeliveryFailureRecord:
      protectedImplementation.eventDeliveryFailureRecord.handler(
        async ({ context, input }) => {
          assertPermission(
            context.session,
            notificationEventPermissions.eventWrite,
            context.authorization
          );

          return serializeOutbox(
            await service.recordEventDeliveryFailure(input)
          );
        }
      ),
    eventPublish: protectedImplementation.eventPublish.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          notificationEventPermissions.eventWrite,
          context.authorization
        );

        return serializeEnvelope(await service.publishEvent(input));
      }
    ),
    notificationDispatch: protectedImplementation.notificationDispatch.handler(
      async ({ context, input }) => {
        assertPermission(
          context.session,
          notificationEventPermissions.notificationWrite,
          context.authorization
        );

        return serializeDispatch(await service.dispatchNotification(input));
      }
    ),
    notificationDispatchList:
      protectedImplementation.notificationDispatchList.handler(
        async ({ context }) => {
          assertPermission(
            context.session,
            notificationEventPermissions.notificationRead,
            context.authorization
          );

          const dispatches = await service.listDispatches();
          return dispatches.map(serializeDispatch);
        }
      ),
    notificationTemplateUpsert:
      protectedImplementation.notificationTemplateUpsert.handler(
        ({ context, input }) => {
          assertPermission(
            context.session,
            notificationEventPermissions.notificationWrite,
            context.authorization
          );

          return service.upsertNotificationTemplate(input);
        }
      ),
  });

  void serializeDeadLetter;

  return {
    key,
    router,
  } as const satisfies CommerceModuleApiFragment<typeof router>;
};

export const notificationEventApiFragment =
  createNotificationEventRouteFragment();
export const notificationEventRouter = notificationEventApiFragment.router;
