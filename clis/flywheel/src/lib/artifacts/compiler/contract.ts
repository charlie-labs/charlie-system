import type { RepositoryState } from '../../repository/contract.js';
import type { ArtifactCompilation, FlywheelArtifact } from '../contract.js';

export type CompiledArtifacts = Readonly<{
  readonly artifacts: readonly FlywheelArtifact[];
  readonly compilations: readonly ArtifactCompilation[];
  readonly state: RepositoryState;
}>;
