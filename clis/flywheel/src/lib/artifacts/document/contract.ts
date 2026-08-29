import type { SourceLocation } from '../../repository/location.js';
import type {
  DocumentSectionTarget,
  DocumentTarget,
} from '../../targets/contract.js';
import type { ArtifactBase, KnowledgeLifecycle } from '../base.js';

export type DocumentMetadata = Readonly<{
  readonly about: readonly string[];
  readonly lifecycle: KnowledgeLifecycle;
  readonly purpose: string;
  readonly replacedBy?: string;
  readonly reviewEvery: string;
}>;

export type DocumentListItem = Readonly<{
  readonly checked?: boolean;
  readonly fragments: readonly SourceFragment[];
  readonly source: SourceLocation;
}>;

export type SourceFragment =
  | Readonly<{
      readonly citationKeys: readonly string[];
      readonly kind: 'prose';
      readonly source: SourceLocation;
      readonly text: string;
    }>
  | Readonly<{
      readonly items: readonly DocumentListItem[];
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly source: SourceLocation;
      readonly start?: number;
    }>
  | Readonly<{
      readonly code: string;
      readonly kind: 'code';
      readonly language?: string;
      readonly metadata?: string;
      readonly source: SourceLocation;
    }>
  | Readonly<{
      readonly alignment: readonly ('center' | 'left' | 'right' | null)[];
      readonly citationKeys: readonly string[];
      readonly kind: 'table';
      readonly rows: readonly (readonly string[])[];
      readonly source: SourceLocation;
    }>
  | Readonly<{
      readonly fragments: readonly SourceFragment[];
      readonly kind: 'blockquote';
      readonly source: SourceLocation;
    }>;

export type DocumentSection = Readonly<{
  readonly depth: number;
  readonly fragments: readonly SourceFragment[];
  readonly heading: string;
  readonly headingPath: readonly string[];
  readonly source: SourceLocation;
  readonly target: DocumentSectionTarget;
}>;

export type CitationDefinition = Readonly<{
  readonly fragments: readonly SourceFragment[];
  readonly key: string;
  readonly source: SourceLocation;
}>;

export type DocumentArtifact = ArtifactBase<'document', DocumentTarget> &
  Readonly<{
    readonly citations: readonly CitationDefinition[];
    readonly metadata: DocumentMetadata;
    readonly preamble: readonly SourceFragment[];
    readonly sections: readonly DocumentSection[];
    readonly title: string;
  }>;
