import type { AuthoredReference } from '../../references/contract.js';
import type { SourceLocation } from '../../repository/location.js';
import type {
  CitationDefinition,
  DocumentSection,
  SourceFragment,
} from '../document/contract.js';

export type MarkdownFrontmatter = Readonly<{
  readonly source: SourceLocation;
  readonly value: string;
  readonly valueOffset: number;
}>;

export type ParsedMarkdown = Readonly<{
  readonly authoredReferences: readonly AuthoredReference[];
  readonly body: string;
  readonly bodySource: SourceLocation;
  readonly citations: readonly CitationDefinition[];
  readonly frontmatter?: MarkdownFrontmatter;
  readonly preamble: readonly SourceFragment[];
  readonly sections: readonly DocumentSection[];
}>;
