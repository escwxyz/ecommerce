import { CommerceError } from "./commerce-error";

export class DuplicateModuleError extends CommerceError {
  readonly moduleKey: string;

  constructor(moduleKey: string) {
    super(
      "duplicate_module",
      `Module "${moduleKey}" is declared more than once.`
    );
    this.name = "DuplicateModuleError";
    this.moduleKey = moduleKey;
  }
}
