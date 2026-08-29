import type { RepositoryEntry } from '../repository/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type { CatalogArtifact } from './catalog/contract.js';
import type { DaemonArtifact } from './daemon/contract.js';
import type { DocumentArtifact } from './document/contract.js';
import type { RoleArtifact } from './role/contract.js';
import type { SkillArtifact } from './skill/contract.js';

export type FlywheelArtifact =
  | CatalogArtifact
  | DaemonArtifact
  | DocumentArtifact
  | RoleArtifact
  | SkillArtifact;

export type ArtifactProblem = Readonly<{
  readonly code: string;
  readonly message: string;
  readonly source: SourceLocation;
}>;

export type ArtifactEntry = Extract<
  RepositoryEntry,
  { readonly kind: 'artifact' }
>;

export type ArtifactCompilation =
  | Readonly<{
      readonly artifacts: readonly FlywheelArtifact[];
      readonly entry: ArtifactEntry;
      readonly kind: 'parsed';
      readonly problems: readonly ArtifactProblem[];
    }>
  | Readonly<{
      readonly entry: ArtifactEntry;
      readonly kind: 'unparsed';
      readonly problems: readonly ArtifactProblem[];
    }>;

export type ArtifactParseInput = Readonly<{
  readonly bytes: Uint8Array;
  readonly entry: ArtifactEntry;
}>;
