import type { CommerceModuleKey, CommerceModuleLifecyclePhase } from "./index";

/** Expected lifecycle failure with module and phase ownership attached. */
export class CommerceModuleLifecycleError extends Error {
  readonly moduleKey: CommerceModuleKey;
  readonly phase: CommerceModuleLifecyclePhase;
  readonly reason: unknown;

  constructor(input: {
    readonly moduleKey: CommerceModuleKey;
    readonly phase: CommerceModuleLifecyclePhase;
    readonly reason: unknown;
  }) {
    super(`Commerce module "${input.moduleKey}" failed during ${input.phase}.`);
    this.name = "CommerceModuleLifecycleError";
    this.moduleKey = input.moduleKey;
    this.phase = input.phase;
    this.reason = input.reason;
  }
}
