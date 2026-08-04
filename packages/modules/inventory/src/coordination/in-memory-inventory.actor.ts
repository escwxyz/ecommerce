import type {
  KeyedActorCommand,
  KeyedActorCommandResult,
  KeyedActorService,
} from "@ecommerce/core/stateful";
import { Effect } from "effect";

const commandIdentity = (command: KeyedActorCommand): string =>
  `${command.actor.type}:${command.actor.key}:${command.idempotencyKey}`;

export class InMemoryInventoryActorService implements KeyedActorService {
  readonly #results = new Map<string, KeyedActorCommandResult>();

  dispatch(command: KeyedActorCommand) {
    return Effect.sync(() => {
      const existing = this.#results.get(commandIdentity(command));

      if (existing) {
        return {
          ...existing,
          duplicate: true,
        };
      }

      const result: KeyedActorCommandResult = {
        actor: command.actor,
        causationId: command.causationId,
        commandId: command.commandId,
        commandName: command.commandName,
        completedAt: new Date().toISOString(),
        correlationId: command.correlationId,
        duplicate: false,
        idempotencyKey: command.idempotencyKey,
        output: null,
        schemaVersion: command.schemaVersion,
        stateVersion: 0,
        subject: command.subject,
        traceId: command.traceId,
        workflowRunId: command.workflowRunId,
      };

      this.#results.set(commandIdentity(command), result);
      return result;
    });
  }
}

export const createInMemoryInventoryActorService = (): KeyedActorService =>
  new InMemoryInventoryActorService();
