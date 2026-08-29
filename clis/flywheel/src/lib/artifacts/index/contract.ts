import type { InspectableTarget } from '../../targets/contract.js';
import type {
  ArtifactEntry,
  ArtifactProblem,
  FlywheelArtifact,
} from '../contract.js';

export type IndexedArtifact =
  | Readonly<{
      readonly artifact: FlywheelArtifact;
      readonly kind: 'inspectable';
      readonly problems: readonly ArtifactProblem[];
      readonly target: InspectableTarget;
    }>
  | Readonly<{
      readonly entry: ArtifactEntry;
      readonly kind: 'unparsed';
      readonly problems: readonly ArtifactProblem[];
    }>;

export type ArtifactIndex = Readonly<{
  readonly byAlias: ReadonlyMap<string, readonly IndexedArtifact[]>;
}>;

export type ArtifactLookup =
  | Readonly<{
      readonly input: string;
      readonly kind: 'found';
      readonly value: IndexedArtifact;
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'ambiguous';
      readonly matches: readonly IndexedArtifact[];
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'not-inspectable';
      readonly targetKind: string;
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'missing';
    }>;
