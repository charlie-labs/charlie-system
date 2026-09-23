export type RepositoryPath = string;
export type RepositoryId = string;

export type RepositoryState = Readonly<{
  readonly kind: 'index' | 'working-tree';
  readonly repositoryPath: string;
}>;

export type RepositorySourceEntry = Readonly<{
  readonly kind: 'directory' | 'file' | 'other' | 'symbolic-link';
  readonly path: RepositoryPath;
}>;

export type FileReadResult =
  | Readonly<{
      readonly kind: 'read';
      readonly path: RepositoryPath;
      readonly bytes: Uint8Array;
    }>
  | Readonly<{
      readonly kind: 'missing';
      readonly path: RepositoryPath;
    }>;

export type RepositorySource = Readonly<{
  readonly state: RepositoryState;
  readonly listEntries: () => Promise<readonly RepositorySourceEntry[]>;
  readonly readFiles: (
    paths: readonly RepositoryPath[]
  ) => Promise<readonly FileReadResult[]>;
}>;

export type RepositoryRegion =
  | Readonly<{ readonly kind: 'core' }>
  | Readonly<{ readonly kind: 'customer-wide' }>
  | Readonly<{
      readonly kind: 'repository-specific';
      readonly repository: RepositoryId;
    }>
  | Readonly<{ readonly kind: 'roles' }>
  | Readonly<{ readonly kind: 'flywheel-state' }>;

export type RepositorySelection =
  | Readonly<{ readonly kind: 'customer-wide-only' }>
  | Readonly<{ readonly kind: 'customer-wide-and-all-repositories' }>
  | Readonly<{
      readonly kind: 'customer-wide-and-repositories';
      readonly repositories: readonly RepositoryId[];
    }>;

export type ArtifactKind = 'catalog' | 'daemon' | 'document' | 'role' | 'skill';

export type RepositoryEntry =
  | Readonly<{
      readonly kind: 'artifact';
      readonly artifactKind: ArtifactKind;
      readonly path: RepositoryPath;
      readonly region: RepositoryRegion;
    }>
  | RepositorySupportEntry
  | Readonly<{
      readonly kind: 'tooling-state';
      readonly path: RepositoryPath;
      readonly region: Readonly<{ readonly kind: 'flywheel-state' }>;
      readonly toolingKind: 'derived' | 'review-manifest';
    }>
  | Readonly<{
      readonly kind: 'prohibited';
      readonly path: RepositoryPath;
      readonly region: RepositoryRegion | undefined;
      readonly rule: 'rules-are-not-flywheel-content';
    }>
  | Readonly<{
      readonly kind: 'unsupported';
      readonly path: RepositoryPath;
      readonly region: RepositoryRegion | undefined;
      readonly reason:
        | 'special-file'
        | 'symbolic-link'
        | 'unsupported-file-type'
        | 'unsupported-location'
        | 'unsupported-path';
    }>;

type RepositorySupportEntry =
  | Readonly<{
      readonly kind: 'support-file';
      readonly artifactKind: 'document';
      readonly path: RepositoryPath;
      readonly region: RepositoryRegion;
    }>
  | Readonly<{
      readonly kind: 'support-file';
      readonly artifactKind: 'daemon' | 'skill';
      readonly owner: RepositoryPath;
      readonly path: RepositoryPath;
      readonly region: RepositoryRegion;
    }>;

export type RepositoryInventory = Readonly<{
  readonly state: RepositoryState;
  readonly directories: readonly RepositoryPath[];
  readonly entries: readonly RepositoryEntry[];
  readonly repositories: readonly RepositoryId[];
}>;
