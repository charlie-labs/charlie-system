import path from 'node:path';

import type {
  ArtifactKind,
  RepositoryEntry,
  RepositoryId,
  RepositoryPath,
  RepositoryRegion,
  RepositorySourceEntry,
} from './contract.js';

const MARKDOWN_EXTENSIONS = new Set(['.markdown', '.md']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

type ScopedClassification = Readonly<{
  readonly core: boolean;
  readonly region: RepositoryRegion;
  readonly scopeStart: number;
}>;

type BundleClassification = Readonly<{
  readonly artifactKind: 'daemon' | 'skill';
  readonly marker: 'DAEMON.md' | 'SKILL.md';
  readonly region: RepositoryRegion;
  readonly scopeStart: number;
}>;

export function classifyRepositoryEntry(
  sourceEntry: RepositorySourceEntry,
  repositories: ReadonlySet<RepositoryId>
): RepositoryEntry {
  const segments = sourceEntry.path.split('/');
  const region = repositoryRegion(segments, repositories);
  if (sourceEntry.path.includes('\\')) {
    return unsupported(sourceEntry.path, region, 'unsupported-path');
  }
  if (sourceEntry.kind === 'symbolic-link') {
    return unsupported(sourceEntry.path, region, 'symbolic-link');
  }
  if (sourceEntry.kind === 'other') {
    return unsupported(sourceEntry.path, region, 'special-file');
  }
  if (isProhibitedRule(segments)) {
    return {
      kind: 'prohibited',
      path: sourceEntry.path,
      region,
      rule: 'rules-are-not-flywheel-content',
    };
  }
  if (region === undefined) {
    return unsupported(sourceEntry.path, region, 'unsupported-location');
  }
  return classifyRegionFile(sourceEntry.path, segments, region);
}

function classifyRegionFile(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  region: RepositoryRegion
): RepositoryEntry {
  switch (region.kind) {
    case 'core':
      return classifyScopedFile(repositoryPath, segments, {
        core: true,
        region,
        scopeStart: 1,
      });
    case 'customer-wide':
      return classifyScopedFile(repositoryPath, segments, {
        core: false,
        region,
        scopeStart: 1,
      });
    case 'repository-specific':
      return classifyScopedFile(repositoryPath, segments, {
        core: false,
        region,
        scopeStart: 3,
      });
    case 'roles':
      return classifyRole(repositoryPath, segments, region);
    case 'flywheel-state':
      return classifyFlywheelState(repositoryPath, segments, region);
  }
  return region;
}

function classifyFlywheelState(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  region: Readonly<{ readonly kind: 'flywheel-state' }>
): RepositoryEntry {
  if (segments.length < 2) {
    return unsupported(repositoryPath, region, 'unsupported-location');
  }
  return {
    kind: 'tooling-state',
    path: repositoryPath,
    region,
    toolingKind:
      repositoryPath === '.flywheel/reviews.yaml'
        ? 'review-manifest'
        : 'derived',
  };
}

function classifyScopedFile(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  classification: ScopedClassification
): RepositoryEntry {
  const { core, region, scopeStart } = classification;
  if (core) {
    return classifyBehaviorFile(repositoryPath, segments, classification);
  }
  const location = segments[scopeStart];
  const hasScopedChild = segments.length > scopeStart + 1;
  if (location === 'docs' && hasScopedChild) {
    return classifyDocumentFile(repositoryPath, region);
  }
  if (location === 'catalog' && hasScopedChild) {
    return classifyCatalogFile(repositoryPath, region);
  }
  return classifyBehaviorFile(repositoryPath, segments, classification);
}

function classifyBehaviorFile(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  classification: ScopedClassification
): RepositoryEntry {
  const { core, region, scopeStart } = classification;
  const location = segments[scopeStart];
  if (location !== '.agents') {
    return unsupported(repositoryPath, region, 'unsupported-location');
  }
  const behaviorKind = segments[scopeStart + 1];
  if (behaviorKind === 'daemons') {
    return classifyBundleFile(repositoryPath, segments, {
      artifactKind: 'daemon',
      marker: 'DAEMON.md',
      region,
      scopeStart,
    });
  }
  if (!core && behaviorKind === 'skills') {
    return classifyBundleFile(repositoryPath, segments, {
      artifactKind: 'skill',
      marker: 'SKILL.md',
      region,
      scopeStart,
    });
  }
  return unsupported(repositoryPath, region, 'unsupported-location');
}

function classifyDocumentFile(
  repositoryPath: RepositoryPath,
  region: RepositoryRegion
): RepositoryEntry {
  return MARKDOWN_EXTENSIONS.has(
    path.posix.extname(repositoryPath).toLowerCase()
  )
    ? artifact(repositoryPath, region, 'document')
    : {
        artifactKind: 'document',
        kind: 'support-file',
        path: repositoryPath,
        region,
      };
}

function classifyCatalogFile(
  repositoryPath: RepositoryPath,
  region: RepositoryRegion
): RepositoryEntry {
  return YAML_EXTENSIONS.has(path.posix.extname(repositoryPath).toLowerCase())
    ? artifact(repositoryPath, region, 'catalog')
    : unsupported(repositoryPath, region, 'unsupported-file-type');
}

function classifyBundleFile(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  classification: BundleClassification
): RepositoryEntry {
  const { artifactKind, marker, region, scopeStart } = classification;
  const bundleName = segments[scopeStart + 2];
  if (bundleName === undefined || segments.length <= scopeStart + 3) {
    return unsupported(repositoryPath, region, 'unsupported-location');
  }
  const markerPath = [...segments.slice(0, scopeStart + 3), marker].join('/');
  if (repositoryPath === markerPath) {
    return artifact(repositoryPath, region, artifactKind);
  }
  return {
    artifactKind,
    kind: 'support-file',
    owner: markerPath,
    path: repositoryPath,
    region,
  };
}

function classifyRole(
  repositoryPath: RepositoryPath,
  segments: readonly string[],
  region: RepositoryRegion
): RepositoryEntry {
  const extension = path.posix.extname(repositoryPath).toLowerCase();
  return segments.length === 2 && YAML_EXTENSIONS.has(extension)
    ? artifact(repositoryPath, region, 'role')
    : unsupported(repositoryPath, region, 'unsupported-file-type');
}

function artifact(
  repositoryPath: RepositoryPath,
  region: RepositoryRegion,
  artifactKind: ArtifactKind
): RepositoryEntry {
  return { artifactKind, kind: 'artifact', path: repositoryPath, region };
}

function unsupported(
  repositoryPath: RepositoryPath,
  region: RepositoryRegion | undefined,
  reason:
    | 'special-file'
    | 'symbolic-link'
    | 'unsupported-file-type'
    | 'unsupported-location'
    | 'unsupported-path'
): RepositoryEntry {
  return { kind: 'unsupported', path: repositoryPath, reason, region };
}

function repositoryRegion(
  segments: readonly string[],
  repositories: ReadonlySet<RepositoryId>
): RepositoryRegion | undefined {
  if (segments[0] === 'core') {
    return { kind: 'core' };
  }
  if (segments[0] === 'customer-wide') {
    return { kind: 'customer-wide' };
  }
  if (segments[0] === 'roles') {
    return { kind: 'roles' };
  }
  if (segments[0] === '.flywheel') {
    return { kind: 'flywheel-state' };
  }
  const repositoryId = `${segments[1]}/${segments[2]}`;
  if (segments[0] === 'repo-specific' && repositories.has(repositoryId)) {
    return { kind: 'repository-specific', repository: repositoryId };
  }
  return undefined;
}

function isProhibitedRule(segments: readonly string[]): boolean {
  if (segments.at(-1) === 'AGENTS.md') {
    return true;
  }
  return segments.some(
    (segment, index) => segment === '.agents' && segments[index + 1] === 'rules'
  );
}
