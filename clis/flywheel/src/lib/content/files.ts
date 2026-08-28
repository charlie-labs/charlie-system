export type ArtifactKind = 'catalog' | 'daemon' | 'document' | 'role' | 'skill';

export type FileCategory =
  | ArtifactKind
  | 'ignored'
  | 'review-state'
  | 'rule'
  | 'support'
  | 'unsupported';

export type ClassifiedFile = Readonly<{
  readonly artifactPath?: string;
  readonly bundlePath?: string;
  readonly category: FileCategory;
  readonly path: string;
  readonly region?: 'core' | 'customer-wide' | 'repo-specific' | 'roles';
  readonly repositoryId?: string;
}>;

export { classifyRepositoryFile } from './file-classification.js';
