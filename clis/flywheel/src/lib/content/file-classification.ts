import path from 'node:path';

import type { ArtifactKind, ClassifiedFile } from './files.js';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.markdown']);
const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

type ScopedPath = Readonly<{
  readonly region: 'core' | 'customer-wide' | 'repo-specific';
  readonly remaining: readonly string[];
  readonly repositoryId?: string;
}>;

export function classifyRepositoryFile(relativePath: string): ClassifiedFile {
  if (relativePath === '.flywheel/reviews.yaml') {
    return { category: 'review-state', path: relativePath };
  }
  const segments = relativePath.split('/');
  if (segments[0] === 'roles') {
    return classifyRoleFile(relativePath, segments);
  }
  const scoped = scopePath(segments);
  if (scoped === undefined) {
    return { category: 'ignored', path: relativePath };
  }
  return classifyScopedFile(relativePath, scoped);
}

function classifyRoleFile(
  relativePath: string,
  segments: readonly string[]
): ClassifiedFile {
  if (path.basename(relativePath) === 'AGENTS.md') {
    return { category: 'rule', path: relativePath, region: 'roles' };
  }
  const isRole =
    segments.length === 2 &&
    YAML_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
  if (isRole) {
    return {
      artifactPath: relativePath,
      category: 'role',
      path: relativePath,
      region: 'roles',
    };
  }
  return { category: 'unsupported', path: relativePath, region: 'roles' };
}

function classifyScopedFile(
  relativePath: string,
  scoped: ScopedPath
): ClassifiedFile {
  const common = scopedFields(relativePath, scoped);
  if (path.basename(relativePath) === 'AGENTS.md') {
    return { ...common, category: 'rule' };
  }
  const location = scoped.remaining[0];
  if (location === 'docs') {
    return classifyDocumentFile(relativePath, scoped, common);
  }
  if (location === 'catalog') {
    return classifyCatalogFile(relativePath, scoped, common);
  }
  if (location === '.agents') {
    return classifyBehaviorFile(relativePath, scoped, common);
  }
  return { ...common, category: 'unsupported' };
}

function classifyDocumentFile(
  relativePath: string,
  scoped: ScopedPath,
  common: Omit<ClassifiedFile, 'category'>
): ClassifiedFile {
  const supported =
    scoped.remaining.length === 2 &&
    DOCUMENT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
  return supported
    ? { ...common, artifactPath: relativePath, category: 'document' }
    : { ...common, category: 'unsupported' };
}

function classifyCatalogFile(
  relativePath: string,
  scoped: ScopedPath,
  common: Omit<ClassifiedFile, 'category'>
): ClassifiedFile {
  const supported =
    scoped.remaining.length >= 2 &&
    YAML_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
  return supported
    ? { ...common, artifactPath: relativePath, category: 'catalog' }
    : { ...common, category: 'unsupported' };
}

function classifyBehaviorFile(
  relativePath: string,
  scoped: ScopedPath,
  common: Omit<ClassifiedFile, 'category'>
): ClassifiedFile {
  const agentsIndex = scoped.remaining.indexOf('.agents');
  const behaviorKind = scoped.remaining[agentsIndex + 1];
  const bundleId = scoped.remaining[agentsIndex + 2];
  const bundleFile = scoped.remaining.slice(agentsIndex + 3);
  if (!isBehaviorBundle(behaviorKind, bundleId, bundleFile)) {
    return { ...common, category: 'unsupported' };
  }
  const bundlePath = scoped.remaining.slice(0, agentsIndex + 3).join('/');
  const primaryName = behaviorKind === 'daemons' ? 'DAEMON.md' : 'SKILL.md';
  const category: ArtifactKind =
    behaviorKind === 'daemons' ? 'daemon' : 'skill';
  if (scoped.region === 'core' && category === 'skill') {
    return { ...common, category: 'unsupported' };
  }
  if (bundleFile.length === 1 && bundleFile[0] === primaryName) {
    return {
      ...common,
      artifactPath: relativePath,
      bundlePath,
      category,
    };
  }
  return {
    ...common,
    bundlePath,
    category: isSupportedBundleFile(bundleFile) ? 'support' : 'unsupported',
  };
}

function scopePath(segments: readonly string[]): ScopedPath | undefined {
  const region = segments[0];
  if (region === 'core' || region === 'customer-wide') {
    return { region, remaining: segments.slice(1) };
  }
  if (
    region === 'repo-specific' &&
    segments.length >= 4 &&
    isRepositorySegment(segments[1]) &&
    isRepositorySegment(segments[2])
  ) {
    return {
      region,
      remaining: segments.slice(3),
      repositoryId: `${segments[1]}/${segments[2]}`,
    };
  }
  return undefined;
}

function scopedFields(
  relativePath: string,
  scoped: ScopedPath
): Omit<ClassifiedFile, 'category'> {
  return {
    path: relativePath,
    region: scoped.region,
    ...(scoped.repositoryId === undefined
      ? {}
      : { repositoryId: scoped.repositoryId }),
  };
}

function isBehaviorBundle(
  behaviorKind: string | undefined,
  bundleId: string | undefined,
  bundleFile: readonly string[]
): boolean {
  return (
    bundleId !== undefined &&
    bundleFile.length > 0 &&
    (behaviorKind === 'daemons' || behaviorKind === 'skills')
  );
}

function isSupportedBundleFile(filePath: readonly string[]): boolean {
  const root = filePath[0];
  return root === 'assets' || root === 'references' || root === 'scripts';
}

function isRepositorySegment(value: string | undefined): boolean {
  return value !== undefined && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}
