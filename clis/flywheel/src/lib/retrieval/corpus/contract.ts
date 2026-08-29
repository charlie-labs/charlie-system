import type { CatalogArtifact } from '../../artifacts/catalog/contract.js';
import type {
  CitationDefinition,
  DocumentArtifact,
} from '../../artifacts/document/contract.js';
import type { RepositorySelection } from '../../repository/contract.js';
import type { SourceLocation } from '../../repository/location.js';
import type { TargetId } from '../../targets/contract.js';

export type KnowledgeContentType = 'catalog' | 'document';

export type LifecycleSelection =
  | Readonly<{ readonly kind: 'active-only' }>
  | Readonly<{ readonly kind: 'include-non-active' }>;

export type RetrievalScope = Readonly<{
  readonly contentTypes: readonly KnowledgeContentType[];
  readonly lifecycle: LifecycleSelection;
  readonly repositories: RepositorySelection;
}>;

export type KnowledgeArtifact = CatalogArtifact | DocumentArtifact;

export type KnowledgeStructuralKind =
  | 'blockquote'
  | 'catalog-field'
  | 'code'
  | 'list'
  | 'prose'
  | 'table';

export type KnowledgeSourceUnit = Readonly<{
  readonly artifact: TargetId;
  readonly authoredText: string;
  readonly citationKeys: readonly string[];
  readonly headingPath: readonly string[];
  readonly id: string;
  readonly section?: TargetId;
  readonly source: SourceLocation;
  readonly structuralKind: KnowledgeStructuralKind;
}>;

type ProjectedCitation = Readonly<{
  readonly artifact: TargetId;
  readonly definition: CitationDefinition;
}>;

export type KnowledgeSourceProjection = Readonly<{
  readonly artifacts: readonly KnowledgeArtifact[];
  readonly citations: readonly ProjectedCitation[];
  readonly units: readonly KnowledgeSourceUnit[];
}>;

export type EligibleKnowledgeCorpus = Readonly<{
  readonly artifactIds: readonly TargetId[];
  readonly scope: RetrievalScope;
  readonly unitIds: readonly string[];
}>;

export type EligibleKnowledgeSource = Readonly<{
  readonly artifacts: readonly KnowledgeArtifact[];
  readonly units: readonly KnowledgeSourceUnit[];
}>;

export type RetrievalScopeOptions = Readonly<{
  readonly contentTypes: readonly KnowledgeContentType[];
  readonly customerWideOnly: boolean;
  readonly includeNonActive: boolean;
  readonly repositoryIds: readonly string[];
}>;
