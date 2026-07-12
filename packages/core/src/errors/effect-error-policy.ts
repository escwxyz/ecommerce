import { Cause, Effect } from "effect";

/**
 * Cause categories used by telemetry and transport boundaries.
 *
 * A Cause can contain more than one category because failures produced by
 * parallel work and finalizers are retained instead of flattened.
 */
export interface CauseClassification {
  readonly hasDefect: boolean;
  readonly hasExpectedFailure: boolean;
  readonly hasInterruption: boolean;
  readonly isInterruptionOnly: boolean;
}

/** Classifies a Cause without discarding any of its original structure. */
export const classifyCause = <E>(
  cause: Cause.Cause<E>
): CauseClassification => ({
  hasDefect: Cause.hasDies(cause),
  hasExpectedFailure: Cause.hasFails(cause),
  hasInterruption: Cause.hasInterrupts(cause),
  isInterruptionOnly: Cause.hasInterruptsOnly(cause),
});

/**
 * Observes the complete failure Cause while preserving the original failure,
 * defect, or interruption semantics.
 *
 * Observers cannot fail. Durable audit persistence must therefore be modeled
 * as an explicit business operation instead of being hidden in this helper.
 */
export const observeCause = <A, E, R, R2>(
  effect: Effect.Effect<A, E, R>,
  observe: (cause: Cause.Cause<E>) => Effect.Effect<void, never, R2>
): Effect.Effect<A, E, R | R2> => Effect.tapCause(effect, observe);
