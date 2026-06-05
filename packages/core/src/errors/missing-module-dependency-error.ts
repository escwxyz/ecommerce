import { CommerceError } from "./commerce-error";

export class MissingModuleDependencyError extends CommerceError {
  readonly moduleKey: string;
  readonly dependencyKey: string;

  constructor(moduleKey: string, dependencyKey: string) {
    super(
      "missing_module_dependency",
      `Module "${moduleKey}" depends on missing module "${dependencyKey}".`
    );
    this.name = "MissingModuleDependencyError";
    this.moduleKey = moduleKey;
    this.dependencyKey = dependencyKey;
  }
}
