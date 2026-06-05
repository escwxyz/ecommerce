import { CommerceError } from "./commerce-error";

export class CyclicModuleDependencyError extends CommerceError {
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(
      "cyclic_module_dependency",
      `Module dependency cycle detected: ${cycle.join(" -> ")}.`
    );
    this.name = "CyclicModuleDependencyError";
    this.cycle = cycle;
  }
}
