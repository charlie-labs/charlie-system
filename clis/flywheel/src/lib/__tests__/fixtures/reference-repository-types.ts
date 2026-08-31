import type {
  GraphRelationship,
  RelationshipProvenance,
} from '../../graph/contract.js';
import type {
  AuthoredReference,
  RelationshipKind,
} from '../../references/contract.js';
import type {
  RepositoryEntry,
  RepositoryRegion,
  RepositorySource,
} from '../../repository/contract.js';
import type { KnowledgeStructuralKind } from '../../retrieval/corpus/contract.js';
import type { ValidationReport } from '../../validation/contract.js';

type SourceStartExpectation = Readonly<{
  readonly column: number;
  readonly line: number;
  readonly path: string;
}>;

type SourceRangeExpectation = SourceStartExpectation &
  Readonly<{
    readonly endColumn: number;
    readonly endLine: number;
  }>;

type RepositoryArtifactKind = Extract<
  RepositoryEntry,
  { readonly kind: 'artifact' | 'support-file' }
>['artifactKind'];

export type ClassificationExpectation = Readonly<{
  readonly expected: Readonly<{
    readonly artifactKind?: RepositoryArtifactKind;
    readonly kind: RepositoryEntry['kind'];
    readonly owner?: string;
    readonly reason?: string;
    readonly region?: RepositoryRegion;
    readonly toolingKind?: 'derived' | 'review-manifest';
  }>;
  readonly path: string;
}>;

export type ParsedArtifactExpectation = Readonly<{
  readonly kind: 'catalog' | 'daemon' | 'document' | 'role' | 'skill';
  readonly path: string;
  readonly source: SourceStartExpectation;
  readonly targetId: string;
}>;

export type AuthoredReferenceExpectation = Readonly<{
  readonly citationKey?: string;
  readonly label?: string;
  readonly origin?: AuthoredReference['origin'];
  readonly path: string;
  readonly raw: string;
  readonly relationship: RelationshipKind;
  readonly source: SourceStartExpectation;
}>;

export type ResolvedReferenceExpectation = Readonly<{
  readonly authored: AuthoredReferenceExpectation;
  readonly sourceTarget: string;
  readonly target: string;
}>;

export type RelationshipExpectation = Readonly<{
  readonly from: string;
  readonly kind: GraphRelationship['kind'];
  readonly provenance: Readonly<{
    readonly kind: RelationshipProvenance['kind'];
    readonly reference?: AuthoredReferenceExpectation;
    readonly rule?: string;
    readonly source?: SourceStartExpectation;
  }>;
  readonly to: string;
}>;

export type SourceUnitExpectation = Readonly<{
  readonly citationKeys: readonly string[];
  readonly headingPath: readonly string[];
  readonly source: SourceRangeExpectation;
  readonly structuralKind: KnowledgeStructuralKind;
}>;

export type ReferenceRepositoryManifest = Readonly<{
  readonly authoredReferences: readonly AuthoredReferenceExpectation[];
  readonly classifications: readonly ClassificationExpectation[];
  readonly directories: readonly string[];
  readonly emptyDirectories: readonly string[];
  readonly parsedArtifacts: readonly ParsedArtifactExpectation[];
  readonly relationships: readonly RelationshipExpectation[];
  readonly repositories: readonly string[];
  readonly resolvedReferences: readonly ResolvedReferenceExpectation[];
  readonly retrieval: Readonly<{
    readonly activeArtifactTitles: readonly string[];
    readonly activeDocumentUnit: SourceUnitExpectation;
    readonly customerWideArtifactTitles: readonly string[];
    readonly includingNonActiveTitles: readonly string[];
    readonly repositoryArtifactTitles: readonly string[];
  }>;
  readonly representativeSourceUnits: readonly SourceUnitExpectation[];
  readonly sourceUnitCount: number;
  readonly validation: Readonly<{
    readonly diagnosticRuleIds: readonly string[];
    readonly status: ValidationReport['status'];
  }>;
}>;

type ReferenceRepositoryObservation = Readonly<{
  readonly listCalls: number;
  readonly readCalls: number;
  readonly readPaths: readonly (readonly string[])[];
}>;

type ReferenceRepositoryOverlay =
  | 'ambiguous'
  | 'duplicate'
  | 'malformed'
  | 'prohibited-unsupported'
  | 'review-invalid'
  | 'review-state'
  | 'secret'
  | 'symlink'
  | 'unresolved';

export type ReferenceRepositoryOptions = Readonly<{
  readonly git?: boolean;
  readonly overlay?: ReferenceRepositoryOverlay;
}>;

export type ReferenceRepositoryFixture = Readonly<{
  readonly manifest: ReferenceRepositoryManifest;
  readonly observation: ReferenceRepositoryObservation;
  readonly repositoryPath: string;
  readonly source: RepositorySource;
}>;
