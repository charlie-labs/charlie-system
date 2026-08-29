import type { SourceLocation } from '../repository/location.js';

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
