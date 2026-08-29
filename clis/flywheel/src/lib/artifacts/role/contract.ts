import type { RoleTarget } from '../../targets/contract.js';
import type { ArtifactBase } from '../base.js';

export type RoleArtifact = ArtifactBase<'role', RoleTarget> &
  Readonly<{
    readonly objective: string;
    readonly roleId: string;
    readonly schemaVersion: string;
  }>;
