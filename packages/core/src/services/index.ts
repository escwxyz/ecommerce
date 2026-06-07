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

export interface ClockService {
  now(): Date;
}

export interface IdGeneratorService {
  nextId(): string;
}

export interface LoggerService {
  log(
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>
  ): void;
}

export interface DatabaseRequest {
  readonly entity: string;
  readonly operation: string;
  readonly input?: Record<string, unknown>;
}

export interface DatabaseRecord {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

export interface DatabaseResponse {
  readonly records: readonly DatabaseRecord[];
}

export interface DatabaseService {
  execute(
    request: DatabaseRequest
  ): Promise<DatabaseResponse> | DatabaseResponse;
}

export interface AuthContextService {
  getActor(): unknown | null;
}

export interface EventPublisherService {
  publish(event: CommerceEventEnvelope): Promise<void> | void;
}

export interface ModuleRegistryService {
  getGraph(): CommerceModuleGraph;
}

export type WorkflowRuntimeService = CommerceWorkflowRuntime;

export type WorkflowMetadataStoreService = CommerceWorkflowMetadataStore;

export type StatefulCoordinatorService = StatefulCoordinator;

export type QueuePublisherService = CommerceQueuePublisher;

export const ClockService = Context.Service<ClockService>(
  "@ecommerce/core/ClockService"
);

export const IdGeneratorService = Context.Service<IdGeneratorService>(
  "@ecommerce/core/IdGeneratorService"
);

export const LoggerService = Context.Service<LoggerService>(
  "@ecommerce/core/LoggerService"
);

export const DatabaseService = Context.Service<DatabaseService>(
  "@ecommerce/core/DatabaseService"
);

export const AuthContextService = Context.Service<AuthContextService>(
  "@ecommerce/core/AuthContextService"
);

export const EventPublisherService = Context.Service<EventPublisherService>(
  "@ecommerce/core/EventPublisherService"
);

export const ModuleRegistryService = Context.Service<ModuleRegistryService>(
  "@ecommerce/core/ModuleRegistryService"
);

export const WorkflowRuntimeService = Context.Service<WorkflowRuntimeService>(
  "@ecommerce/core/WorkflowRuntimeService"
);

export const WorkflowMetadataStoreService =
  Context.Service<WorkflowMetadataStoreService>(
    "@ecommerce/core/WorkflowMetadataStoreService"
  );

export const StatefulCoordinatorService =
  Context.Service<StatefulCoordinatorService>(
    "@ecommerce/core/StatefulCoordinatorService"
  );

export const QueuePublisherService = Context.Service<QueuePublisherService>(
  "@ecommerce/core/QueuePublisherService"
);

export const clockLayer = (service: ClockService) =>
  Layer.succeed(ClockService, service);

export const idGeneratorLayer = (service: IdGeneratorService) =>
  Layer.succeed(IdGeneratorService, service);

export const loggerLayer = (service: LoggerService) =>
  Layer.succeed(LoggerService, service);

export const databaseLayer = (service: DatabaseService) =>
  Layer.succeed(DatabaseService, service);

export const authContextLayer = (service: AuthContextService) =>
  Layer.succeed(AuthContextService, service);

export const eventPublisherLayer = (service: EventPublisherService) =>
  Layer.succeed(EventPublisherService, service);

export const moduleRegistryLayer = (service: ModuleRegistryService) =>
  Layer.succeed(ModuleRegistryService, service);

export const workflowRuntimeLayer = (service: WorkflowRuntimeService) =>
  Layer.succeed(WorkflowRuntimeService, service);

export const workflowMetadataStoreLayer = (
  service: WorkflowMetadataStoreService
) => Layer.succeed(WorkflowMetadataStoreService, service);

export const statefulCoordinatorLayer = (service: StatefulCoordinatorService) =>
  Layer.succeed(StatefulCoordinatorService, service);

export const queuePublisherLayer = (service: QueuePublisherService) =>
  Layer.succeed(QueuePublisherService, service);
