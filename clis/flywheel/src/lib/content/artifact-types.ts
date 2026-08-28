import type { ContentDiagnostic } from './errors.js';
import type { ClassifiedFile, FileCategory } from './files.js';

export type ArtifactScope =
  | 'core'
  | 'customer-wide'
  | 'repo-specific'
  | 'roles';

export type AuthoredReference = Readonly<{
  readonly kind: 'catalog' | 'external' | 'internal';
  readonly raw: string;
  readonly source: string;
  readonly target?: string;
}>;

export type ParsedArtifact = Readonly<{
  readonly artifactPath: string;
  readonly bundlePath?: string;
  readonly category: Extract<
    FileCategory,
    'catalog' | 'daemon' | 'document' | 'role' | 'skill'
  >;
  readonly headings?: readonly string[];
  readonly id?: string;
  readonly references: readonly AuthoredReference[];
  readonly region: ArtifactScope;
  readonly repositoryId?: string;
  readonly roleId?: string;
  readonly target: string;
}>;

export type ParsedFile = Readonly<{
  readonly artifact?: ParsedArtifact;
  readonly classified: ClassifiedFile;
  readonly content?: string;
  readonly diagnostics: readonly ContentDiagnostic[];
}>;
