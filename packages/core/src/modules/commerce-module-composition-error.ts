import type { CommerceModuleKey } from "./index";

export type CommerceModuleCompositionErrorDetail =
  | {
      readonly _tag: "DuplicateContribution";
      readonly contributionKind: string;
      readonly existingOwner: CommerceModuleKey;
      readonly key: string;
      readonly owner: CommerceModuleKey;
    }
  | {
      readonly _tag: "InvalidServiceContributionKey";
      readonly key: string;
      readonly owner: CommerceModuleKey;
    }
  | {
      readonly _tag: "MissingExecutableContributionField";
      readonly contributionKind: string;
      readonly field: string;
      readonly key: string;
      readonly owner: CommerceModuleKey;
    };

/** Closed validation error for executable contribution conflicts. */
export class CommerceModuleCompositionError extends Error {
  readonly detail: CommerceModuleCompositionErrorDetail;

  constructor(detail: CommerceModuleCompositionErrorDetail) {
    let message: string;
    switch (detail._tag) {
      case "DuplicateContribution": {
        message = `Duplicate ${detail.contributionKind} contribution "${detail.key}" from "${detail.owner}" conflicts with "${detail.existingOwner}".`;
        break;
      }
      case "InvalidServiceContributionKey": {
        message = `Service contribution "${detail.key}" from "${detail.owner}" must be namespaced with "${detail.owner}:".`;
        break;
      }
      case "MissingExecutableContributionField": {
        message = `${detail.contributionKind} contribution "${detail.key}" from "${detail.owner}" is missing executable field "${detail.field}".`;
        break;
      }
      default: {
        message = "Invalid commerce module composition.";
        break;
      }
    }
    super(message);
    this.name = "CommerceModuleCompositionError";
    this.detail = detail;
  }
}
