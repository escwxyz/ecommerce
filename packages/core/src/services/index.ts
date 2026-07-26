import { Context, Layer } from "effect";

import type { CommerceEventEnvelope } from "../events/index";
import type { CommerceModuleGraph } from "../modules/index";
import type { CommerceQueuePublisher } from "../queues/index";
import type { StatefulCoordinator } from "../stateful/index";
import type {
  CommerceWorkflowMetadataStore,
  CommerceWorkflowRuntime,
} from "../workflows/index";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Runtime-neutral clock contract used by legacy callers during Effect migration. */
export interface ClockService {
  now(): Date;
}

/** Runtime-neutral ID source; production adapters decide uniqueness strategy. */
export interface IdGeneratorService {
  nextId(): string;
}

/** Minimal structured logger bridge kept until Effect telemetry owns all logging. */
export interface LoggerService {
  log(
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>
  ): void;
}

/**
 * Temporary database request shape for unmigrated code.
 *
 * New module slices should define repository services instead of depending on
 * this generic database bridge. Task 3.1 introduces the permanent repository,
 * transaction, migration, and outbox contracts.
 */
export interface DatabaseRequest {
  readonly entity: string;
  readonly operation: string;
  readonly input?: Record<string, unknown>;
}

/** Result record for the temporary generic database bridge. */
export interface DatabaseRecord {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

/** Result envelope for the temporary generic database bridge. */
export interface DatabaseResponse {
  readonly records: readonly DatabaseRecord[];
}

/** Temporary database bridge; do not use for newly migrated Effect modules. */
export interface DatabaseService {
  execute(
    request: DatabaseRequest
  ): Promise<DatabaseResponse> | DatabaseResponse;
}

/** Request actor context visible to runtime-neutral domain/application code. */
export interface AuthContextService {
  getActor(): unknown | null;
}

/** Runtime-neutral event publisher used before transactional outbox contracts land. */
export interface EventPublisherService {
  publish(event: CommerceEventEnvelope): Promise<void> | void;
}

/** Reads the composed commerce module graph without importing app/server code. */
export interface ModuleRegistryService {
  getGraph(): CommerceModuleGraph;
}

/** Durable workflow runtime contract exposed as an Effect service tag. */
export type WorkflowRuntimeService = CommerceWorkflowRuntime;

/** Durable workflow metadata projection contract exposed as an Effect service tag. */
export type WorkflowMetadataStoreService = CommerceWorkflowMetadataStore;

/**
 * Legacy Promise coordinator exposed as an Effect service tag.
 *
 * @deprecated Task 9.6 replaces its Cloudflare adapter with
 * `KeyedActorService` from `@ecommerce/core/stateful`.
 */
export type StatefulCoordinatorService = StatefulCoordinator;

/** Runtime-neutral queue publisher contract exposed as an Effect service tag. */
export type QueuePublisherService = CommerceQueuePublisher;

/** Effect tag for deterministic time dependencies. */
export const ClockService = Context.Service<ClockService>(
  "@ecommerce/core/ClockService"
);

/** Effect tag for deterministic ID generation dependencies. */
export const IdGeneratorService = Context.Service<IdGeneratorService>(
  "@ecommerce/core/IdGeneratorService"
);

/** Effect tag for the temporary logger bridge. */
export const LoggerService = Context.Service<LoggerService>(
  "@ecommerce/core/LoggerService"
);

/** Effect tag for the temporary generic database bridge. */
export const DatabaseService = Context.Service<DatabaseService>(
  "@ecommerce/core/DatabaseService"
);

/** Effect tag for request actor context. */
export const AuthContextService = Context.Service<AuthContextService>(
  "@ecommerce/core/AuthContextService"
);

/** Effect tag for publishing domain events without platform imports. */
export const EventPublisherService = Context.Service<EventPublisherService>(
  "@ecommerce/core/EventPublisherService"
);

/** Effect tag for the composed module graph. */
export const ModuleRegistryService = Context.Service<ModuleRegistryService>(
  "@ecommerce/core/ModuleRegistryService"
);

/** Effect tag for workflow runtime implementations. */
export const WorkflowRuntimeService = Context.Service<WorkflowRuntimeService>(
  "@ecommerce/core/WorkflowRuntimeService"
);

/** Effect tag for workflow metadata storage implementations. */
export const WorkflowMetadataStoreService =
  Context.Service<WorkflowMetadataStoreService>(
    "@ecommerce/core/WorkflowMetadataStoreService"
  );

/** @deprecated Use `KeyedActorService` from `@ecommerce/core/stateful`. */
export const StatefulCoordinatorService =
  Context.Service<StatefulCoordinatorService>(
    "@ecommerce/core/StatefulCoordinatorService"
  );

/** Effect tag for queue publisher implementations. */
export const QueuePublisherService = Context.Service<QueuePublisherService>(
  "@ecommerce/core/QueuePublisherService"
);

/** Creates a Layer for a clock implementation. */
export const clockLayer = (service: ClockService) =>
  Layer.succeed(ClockService, service);

/** Creates a Layer for an ID generator implementation. */
export const idGeneratorLayer = (service: IdGeneratorService) =>
  Layer.succeed(IdGeneratorService, service);

/** Creates a Layer for the temporary logger bridge. */
export const loggerLayer = (service: LoggerService) =>
  Layer.succeed(LoggerService, service);

/** Creates a Layer for the temporary generic database bridge. */
export const databaseLayer = (service: DatabaseService) =>
  Layer.succeed(DatabaseService, service);

/** Creates a Layer for request actor context. */
export const authContextLayer = (service: AuthContextService) =>
  Layer.succeed(AuthContextService, service);

/** Creates a Layer for domain event publishing. */
export const eventPublisherLayer = (service: EventPublisherService) =>
  Layer.succeed(EventPublisherService, service);

/** Creates a Layer for the composed commerce module graph. */
export const moduleRegistryLayer = (service: ModuleRegistryService) =>
  Layer.succeed(ModuleRegistryService, service);

/** Creates a Layer for workflow runtime implementations. */
export const workflowRuntimeLayer = (service: WorkflowRuntimeService) =>
  Layer.succeed(WorkflowRuntimeService, service);

/** Creates a Layer for workflow metadata storage implementations. */
export const workflowMetadataStoreLayer = (
  service: WorkflowMetadataStoreService
) => Layer.succeed(WorkflowMetadataStoreService, service);

/** @deprecated Use `keyedActorLayer` from `@ecommerce/core/stateful`. */
export const statefulCoordinatorLayer = (service: StatefulCoordinatorService) =>
  Layer.succeed(StatefulCoordinatorService, service);

/** Creates a Layer for queue publisher implementations. */
export const queuePublisherLayer = (service: QueuePublisherService) =>
  Layer.succeed(QueuePublisherService, service);
