import type { KnowledgeLifecycle } from '../../artifacts/base.js';
import type { CitationDefinition } from '../../artifacts/document/contract.js';
import type { RepositoryPath } from '../../repository/contract.js';
import type { SourceLocation } from '../../repository/location.js';
import type {
  CatalogTarget,
  DocumentTarget,
  TargetId,
} from '../../targets/contract.js';
import type {
  AssessedRepository,
  ValidationDiagnostic,
} from '../../validation/contract.js';
import type {
  KnowledgeContentType,
  KnowledgeStructuralKind,
  LifecycleSelection,
  RetrievalScope,
} from '../corpus/contract.js';
import type { RetrievalCandidateSource } from './candidate-source.js';

export type SearchPassage = Readonly<{
  readonly authoredText: string;
  readonly headingPath: readonly string[];
  readonly omittedAfter: boolean;
  readonly omittedBefore: boolean;
  readonly section?: TargetId;
  readonly source: SourceLocation;
  readonly structuralKind: KnowledgeStructuralKind;
}>;

export type ArtifactSearchResult = Readonly<{
  readonly artifact: CatalogTarget | DocumentTarget;
  readonly citations: readonly CitationDefinition[];
  readonly contentType: KnowledgeContentType;
  readonly lifecycle: KnowledgeLifecycle;
  readonly passages: readonly SearchPassage[];
  readonly path: RepositoryPath;
  readonly title: string;
}>;

export type SearchContext = Readonly<{
  readonly contentTypes: readonly KnowledgeContentType[];
  readonly lifecycleSelection: LifecycleSelection;
  readonly query: string;
  readonly repositorySelection: RetrievalScope['repositories'];
}>;

export type SearchNotice =
  | Readonly<{
      readonly excludedArtifacts: number;
      readonly kind: 'inactive-content-excluded';
    }>
  | Readonly<{
      readonly kind: 'response-shortened';
      readonly omittedArtifacts: number;
      readonly omittedPassages: number;
    }>;

type SuccessfulSearchOutcome =
  | Readonly<{
      readonly context: SearchContext;
      readonly kind: 'results';
      readonly notices: readonly SearchNotice[];
      readonly results: readonly ArtifactSearchResult[];
    }>
  | Readonly<{
      readonly context: SearchContext;
      readonly kind: 'no-eligible-content';
      readonly notices: readonly SearchNotice[];
    }>
  | Readonly<{
      readonly context: SearchContext;
      readonly kind: 'no-useful-result';
      readonly notices: readonly SearchNotice[];
    }>;

type SearchUnavailableReason =
  | 'backend-unavailable'
  | 'candidate-source-invalid'
  | 'projection-incomplete'
  | 'repository-invalid'
  | 'repository-unavailable';

export type SearchOutcome =
  | SuccessfulSearchOutcome
  | Readonly<{
      readonly kind: 'invalid-selection';
      readonly message: string;
    }>
  | Readonly<{
      readonly context: SearchContext;
      readonly diagnostics: readonly ValidationDiagnostic[];
      readonly kind: 'unavailable';
      readonly message: string;
      readonly reason: SearchUnavailableReason;
    }>
  | Readonly<{
      readonly kind: 'unsupported';
      readonly operation: string;
    }>;

export type AssessedSearchInput = Readonly<{
  readonly artifactLimit: number;
  readonly candidateSource: RetrievalCandidateSource;
  readonly passageLimitPerArtifact: number;
  readonly query: string;
  readonly repository: AssessedRepository;
  readonly scope: RetrievalScope;
}>;
