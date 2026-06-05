import type * as Context from "effect/Context";
import type { Effect } from "effect/Effect";

import type { AdminMetadataSurface, AdminSurfaceKind } from "../admin/index";
import {
  CyclicModuleDependencyError,
  DuplicateModuleError,
  MissingModuleDependencyError,
} from "../errors/index";
import type { CommercePluginContributionSet } from "../plugins/index";
import type {
  CommerceWorkflowDefinition,
  CommerceWorkflowStep,
} from "../workflows/index";

export type CommerceModuleKey = string;

export interface CommerceModuleApiFragment<
  TRouter extends Record<string, unknown> = Record<string, unknown>,
  TKey extends string = string,
> {
  readonly key: TKey;
  readonly router: TRouter;
}

export type CommerceAdminSurfaceKind = AdminSurfaceKind;

export type CommerceAdminSurface = AdminMetadataSurface;

export type CommerceModuleLifecycleHook<
  Error = never,
  Requirements = never,
> = Effect<void, Error, Requirements>;

export interface CommerceModuleLifecycle<Error = never, Requirements = never> {
  readonly onRegister?: CommerceModuleLifecycleHook<Error, Requirements>;
  readonly onBootstrap?: CommerceModuleLifecycleHook<Error, Requirements>;
  readonly onShutdown?: CommerceModuleLifecycleHook<Error, Requirements>;
}

export interface CommerceModuleProvidedService<
  Identifier = unknown,
  Shape = unknown,
> {
  readonly key: string;
  readonly service: Context.Key<Identifier, Shape>;
}

export interface CommerceModuleContributions {
  readonly apiFragments?: readonly CommerceModuleApiFragment[];
  readonly adminSurfaces?: readonly CommerceAdminSurface[];
  readonly eventTypes?: readonly string[];
  readonly workflowSteps?: readonly CommerceWorkflowStep[];
  readonly workflows?: readonly CommerceWorkflowDefinition[];
  readonly pluginContributions?: CommercePluginContributionSet;
}

export interface CommerceModuleDefinition<
  Key extends CommerceModuleKey = CommerceModuleKey,
  Dependencies extends readonly CommerceModuleKey[] =
    readonly CommerceModuleKey[],
> {
  readonly key: Key;
  readonly dependencies?: Dependencies;
  readonly providedServices?: readonly CommerceModuleProvidedService[];
  readonly lifecycle?: CommerceModuleLifecycle;
  readonly contributions?: CommerceModuleContributions;
}

export type ModuleKeyUnion<
  Modules extends readonly CommerceModuleDefinition[],
> = Modules[number]["key"];

export type MissingDependencyKeys<
  Modules extends readonly CommerceModuleDefinition[],
> = Exclude<
  Modules[number]["dependencies"] extends readonly string[]
    ? Modules[number]["dependencies"][number]
    : never,
  ModuleKeyUnion<Modules>
>;

export type ValidateModuleDependencies<
  Modules extends readonly CommerceModuleDefinition[],
> = [MissingDependencyKeys<Modules>] extends [never] ? true : false;

export interface CommerceModuleGraph<
  Modules extends readonly CommerceModuleDefinition[] =
    readonly CommerceModuleDefinition[],
> {
  readonly modules: Modules;
  readonly byKey: ReadonlyMap<CommerceModuleKey, CommerceModuleDefinition>;
  readonly orderedKeys: readonly CommerceModuleKey[];
}

export const defineCommerceModule = <
  const Key extends CommerceModuleKey,
  const Dependencies extends readonly CommerceModuleKey[] = [],
>(
  definition: CommerceModuleDefinition<Key, Dependencies>
): CommerceModuleDefinition<Key, Dependencies> => definition;

const getDependencies = (
  moduleDefinition: CommerceModuleDefinition
): readonly CommerceModuleKey[] => moduleDefinition.dependencies ?? [];

export const validateCommerceModules = <
  const Modules extends readonly CommerceModuleDefinition[],
>(
  modules: Modules
): void => {
  const byKey = new Map<CommerceModuleKey, CommerceModuleDefinition>();

  for (const moduleDefinition of modules) {
    if (byKey.has(moduleDefinition.key)) {
      throw new DuplicateModuleError(moduleDefinition.key);
    }

    byKey.set(moduleDefinition.key, moduleDefinition);
  }

  for (const moduleDefinition of modules) {
    for (const dependencyKey of getDependencies(moduleDefinition)) {
      if (!byKey.has(dependencyKey)) {
        throw new MissingModuleDependencyError(
          moduleDefinition.key,
          dependencyKey
        );
      }
    }
  }

  const visited = new Set<CommerceModuleKey>();
  const visiting = new Set<CommerceModuleKey>();
  const trail: CommerceModuleKey[] = [];

  const visit = (moduleKey: CommerceModuleKey): void => {
    if (visited.has(moduleKey)) {
      return;
    }

    if (visiting.has(moduleKey)) {
      const cycleStartIndex = trail.indexOf(moduleKey);
      const cycle = [...trail.slice(cycleStartIndex), moduleKey];
      throw new CyclicModuleDependencyError(cycle);
    }

    visiting.add(moduleKey);
    trail.push(moduleKey);

    const moduleDefinition = byKey.get(moduleKey);

    if (!moduleDefinition) {
      return;
    }

    for (const dependencyKey of getDependencies(moduleDefinition)) {
      visit(dependencyKey);
    }

    trail.pop();
    visiting.delete(moduleKey);
    visited.add(moduleKey);
  };

  for (const moduleDefinition of modules) {
    visit(moduleDefinition.key);
  }
};

export const composeCommerceModules = <
  const Modules extends readonly CommerceModuleDefinition[],
>(
  modules: Modules
): CommerceModuleGraph<Modules> => {
  validateCommerceModules(modules);

  const byKey = new Map<CommerceModuleKey, CommerceModuleDefinition>();
  const orderedKeys: CommerceModuleKey[] = [];
  const visited = new Set<CommerceModuleKey>();

  for (const moduleDefinition of modules) {
    byKey.set(moduleDefinition.key, moduleDefinition);
  }

  const order = (moduleKey: CommerceModuleKey): void => {
    if (visited.has(moduleKey)) {
      return;
    }

    visited.add(moduleKey);

    const moduleDefinition = byKey.get(moduleKey);

    if (!moduleDefinition) {
      return;
    }

    for (const dependencyKey of getDependencies(moduleDefinition)) {
      order(dependencyKey);
    }

    orderedKeys.push(moduleKey);
  };

  for (const moduleDefinition of modules) {
    order(moduleDefinition.key);
  }

  return {
    modules,
    byKey,
    orderedKeys,
  };
};
