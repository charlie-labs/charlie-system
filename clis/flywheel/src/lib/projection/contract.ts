import type {
  ArtifactCompilation,
  FlywheelArtifact,
} from '../artifacts/contract.js';
import type {
  RepositoryGraph,
  RepositoryGraphIndex,
} from '../graph/contract.js';
import type { ReferenceResolution } from '../references/contract.js';
import type {
  RepositoryInventory,
  RepositoryPath,
  RepositoryState,
} from '../repository/contract.js';
import type { TargetId } from '../targets/contract.js';

export type RepositoryProjection = Readonly<{
  readonly compilations: readonly ArtifactCompilation[];
  readonly graph: RepositoryGraph;
  readonly inventory: RepositoryInventory;
  readonly resolutions: readonly ReferenceResolution[];
  readonly source: RepositoryState;
}>;

export type RepositoryIndexes = Readonly<{
  readonly aliases: ReadonlyMap<string, readonly TargetId[]>;
  readonly artifactByTarget: ReadonlyMap<TargetId, FlywheelArtifact>;
  readonly artifactsByPath: ReadonlyMap<
    RepositoryPath,
    readonly FlywheelArtifact[]
  >;
  readonly graph: RepositoryGraphIndex;
}>;
