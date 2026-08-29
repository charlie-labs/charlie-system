import type {
  RepositoryEntry,
  RepositoryPath,
} from '../repository/contract.js';
import type { SourceLocation } from '../repository/location.js';
import type { GraphTarget, InspectableTarget } from '../targets/contract.js';
import type { TargetLookupIndex } from '../targets/lookup.js';

export type RelationshipKind =
  | 'about'
  | 'applies-to'
  | 'cites'
  | 'consumes-api'
  | 'contains'
  | 'contributes-to'
  | 'declares'
  | 'depends-on'
  | 'documents'
  | 'links-to'
  | 'member-of'
  | 'mentions'
  | 'owned-by'
  | 'part-of'
  | 'provides-api'
  | 'represents'
  | 'reviewed-by'
  | 'supersedes'
  | 'uses';

export type AuthoredReference = Readonly<{
  readonly citationKey?: string;
  readonly label?: string;
  readonly origin?: 'document.replacedBy';
  readonly raw: string;
  readonly relationship: RelationshipKind;
  readonly source: SourceLocation;
}>;

export type ReferenceResolutionReason =
  | 'ambiguous-target'
  | 'invalid-syntax'
  | 'unknown-target'
  | 'unsupported-target';

export type ReferenceResolution =
  | Readonly<{
      readonly authored: AuthoredReference;
      readonly kind: 'resolved';
      readonly sourceTarget: InspectableTarget;
      readonly target: GraphTarget;
    }>
  | Readonly<{
      readonly authored: AuthoredReference;
      readonly candidates?: readonly GraphTarget[];
      readonly kind: 'unresolved';
      readonly reason: ReferenceResolutionReason;
      readonly sourceTarget: InspectableTarget;
    }>;

export type ReferenceIndex = Readonly<{
  readonly supportByPath: ReadonlyMap<RepositoryPath, RepositorySupportEntry>;
  readonly targets: TargetLookupIndex;
}>;

type RepositorySupportEntry = Extract<
  RepositoryEntry,
  { readonly kind: 'support-file' }
>;
