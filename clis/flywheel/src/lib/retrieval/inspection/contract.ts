import type {
  FlywheelArtifact,
  ArtifactEntry,
  ArtifactProblem,
} from '../../artifacts/contract.js';
import type { InspectableTarget, TargetId } from '../../targets/contract.js';

export type InspectionCandidate =
  | Readonly<{
      readonly artifactKind: FlywheelArtifact['kind'];
      readonly kind: 'inspectable';
      readonly path: string;
      readonly target: InspectableTarget;
      readonly targetId: TargetId;
    }>
  | Readonly<{
      readonly artifactKind: ArtifactEntry['artifactKind'];
      readonly kind: 'unparsed';
      readonly path: string;
    }>;

export type ArtifactInspection =
  | Readonly<{
      readonly artifact: FlywheelArtifact;
      readonly input: string;
      readonly kind: 'artifact';
      readonly problems: readonly ArtifactProblem[];
      readonly target: InspectableTarget;
      readonly targetId: TargetId;
    }>
  | Readonly<{
      readonly entry: ArtifactEntry;
      readonly input: string;
      readonly kind: 'unparsed';
      readonly problems: readonly ArtifactProblem[];
    }>
  | Readonly<{
      readonly candidates: readonly InspectionCandidate[];
      readonly input: string;
      readonly kind: 'ambiguous';
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
