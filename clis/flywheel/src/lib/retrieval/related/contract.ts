import type {
  GraphRelationship,
  GraphTargetRecord,
  RelationshipProvenance,
} from '../../graph/contract.js';

export type RelatedRelationship = Readonly<{
  readonly direction: 'incoming' | 'outgoing';
  readonly kind: GraphRelationship['kind'];
  readonly provenance: RelationshipProvenance;
  readonly target: GraphTargetRecord;
}>;

export type RelatedResult =
  | Readonly<{
      readonly input: string;
      readonly kind: 'related';
      readonly relationships: readonly RelatedRelationship[];
      readonly target: GraphTargetRecord;
    }>
  | Readonly<{
      readonly candidates: readonly GraphTargetRecord[];
      readonly input: string;
      readonly kind: 'ambiguous';
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'missing';
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'unsupported-target';
      readonly target: GraphTargetRecord;
    }>;
