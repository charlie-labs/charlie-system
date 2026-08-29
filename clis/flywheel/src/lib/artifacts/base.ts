import type { AuthoredReference } from '../references/contract.js';
import type {
  ArtifactKind,
  RepositoryPath,
  RepositoryRegion,
} from '../repository/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type { InspectableTarget } from '../targets/contract.js';

export type KnowledgeLifecycle = Readonly<{
  readonly active: boolean;
  readonly status: string;
}>;

export type ArtifactBase<
  Kind extends ArtifactKind,
  Target extends InspectableTarget,
> = Readonly<{
  readonly authoredReferences: readonly AuthoredReference[];
  readonly kind: Kind;
  readonly path: RepositoryPath;
  readonly region: RepositoryRegion;
  readonly source: SourceLocation;
  readonly target: Target;
}>;
