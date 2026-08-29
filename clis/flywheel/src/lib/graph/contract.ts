import type {
  AuthoredReference,
  RelationshipKind,
} from '../references/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type { GraphTarget, TargetId } from '../targets/contract.js';

export type GraphTargetRecord = Readonly<{
  readonly id: TargetId;
  readonly target: GraphTarget;
}>;

type StructuralRelationshipRule =
  | 'artifact-contains-support-resource'
  | 'document-contains-section';

export type RelationshipProvenance =
  | Readonly<{
      readonly kind: 'authored';
      readonly reference: AuthoredReference;
    }>
  | Readonly<{
      readonly kind: 'structural';
      readonly rule: StructuralRelationshipRule;
      readonly source: SourceLocation;
    }>;

export type GraphRelationship = Readonly<{
  readonly from: TargetId;
  readonly kind: RelationshipKind;
  readonly provenance: RelationshipProvenance;
  readonly to: TargetId;
}>;

export type RepositoryGraph = Readonly<{
  readonly relationships: readonly GraphRelationship[];
  readonly targets: readonly GraphTargetRecord[];
}>;

export type RepositoryGraphIndex = Readonly<{
  readonly incomingByTarget: ReadonlyMap<
    TargetId,
    readonly GraphRelationship[]
  >;
  readonly outgoingByTarget: ReadonlyMap<
    TargetId,
    readonly GraphRelationship[]
  >;
  readonly targetById: ReadonlyMap<TargetId, GraphTarget>;
}>;
