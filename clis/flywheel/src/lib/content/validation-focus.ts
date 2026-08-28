import path from 'node:path';

import { ContentInvocationError } from './errors.js';
import {
  classifyRepositoryFile,
  type ArtifactKind,
  type ClassifiedFile,
} from './files.js';
import type { RepositoryFile } from './repository-state.js';
import type {
  ClassifiedFileWithMode,
  DiagnosticFilterContext,
  Focus,
} from './validation-types.js';

export function classifyFiles(
  files: readonly RepositoryFile[]
): readonly ClassifiedFileWithMode[] {
  return files.map((file) => classifyFile(file));
}

export function resolveFocus(
  paths: readonly string[],
  repositoryPath: string,
  classifiedFiles: readonly ClassifiedFileWithMode[]
): Focus {
  if (paths.length === 0) {
    return allFilesFocus(classifiedFiles);
  }
  const requested = paths.map((requestedPath) =>
    resolveRequestedPath(repositoryPath, requestedPath)
  );
  const knownPaths = new Set(classifiedFiles.map((file) => file.path));
  const selected = new Set<string>();
  for (const requestedPath of requested) {
    const matches = matchingPaths(knownPaths, requestedPath);
    if (matches.length === 0) {
      throw new ContentInvocationError(
        `selected repository path does not exist: ${requestedPath}`
      );
    }
    for (const match of matches) {
      selected.add(match);
    }
  }
  return selectedFocus(selected, classifiedFiles);
}

export function includeDiagnostic(
  diagnostic: { readonly path: string },
  context: DiagnosticFilterContext
): boolean {
  if (!context.hasPaths && context.artifactKinds === undefined) {
    return true;
  }
  if (
    context.artifactKinds !== undefined &&
    !matchesArtifactSelection(diagnostic.path, context)
  ) {
    return false;
  }
  return !context.hasPaths || matchesFocus(diagnostic.path, context);
}

function classifyFile(file: RepositoryFile): ClassifiedFileWithMode {
  return Object.assign(classifyRepositoryFile(file.path), {
    mode: file.mode,
    ...(file.stage === undefined ? {} : { stage: file.stage }),
  });
}

function allFilesFocus(
  classifiedFiles: readonly ClassifiedFileWithMode[]
): Focus {
  return selectedFocus(
    new Set(classifiedFiles.map((file) => file.path)),
    classifiedFiles
  );
}

function selectedFocus(
  selected: ReadonlySet<string>,
  classifiedFiles: readonly ClassifiedFileWithMode[]
): Focus {
  const selectedBundles = new Set(
    classifiedFiles
      .filter((file) => selected.has(file.path) && file.category === 'support')
      .map((file) => file.bundlePath)
  );
  return {
    paths: selected,
    selectedArtifacts: new Set(
      classifiedFiles
        .filter(
          (file) =>
            (selected.has(file.path) && isArtifactKind(file.category)) ||
            (file.artifactPath !== undefined &&
              selectedBundles.has(file.bundlePath))
        )
        .map((file) => file.path)
    ),
  };
}

function matchingPaths(
  knownPaths: ReadonlySet<string>,
  requestedPath: string
): readonly string[] {
  return [...knownPaths].filter(
    (candidate) =>
      candidate === requestedPath || candidate.startsWith(`${requestedPath}/`)
  );
}

function resolveRequestedPath(
  repositoryPath: string,
  requestedPath: string
): string {
  if (requestedPath.trim() === '' || requestedPath.includes('\\')) {
    throw new ContentInvocationError(
      `invalid repository path: ${requestedPath}`
    );
  }
  const candidate = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(repositoryPath, requestedPath);
  const relativePath = path
    .relative(repositoryPath, candidate)
    .split(path.sep)
    .join('/');
  if (!isAdmittedPath(relativePath)) {
    throw new ContentInvocationError(
      `path is outside admitted Flywheel content roots: ${requestedPath}`
    );
  }
  return relativePath;
}

function isAdmittedPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  if (
    segments[0] === 'roles' ||
    segments[0] === 'core' ||
    segments[0] === 'customer-wide'
  ) {
    return true;
  }
  return segments[0] === 'repo-specific' && segments.length >= 3;
}

function matchesArtifactSelection(
  diagnosticPath: string,
  context: DiagnosticFilterContext
): boolean {
  const classified = context.classifiedFiles.find(
    (file) => file.path === diagnosticPath
  );
  if (classified !== undefined && isArtifactKind(classified.category)) {
    return context.artifactKinds?.includes(classified.category) ?? false;
  }
  if (classified?.category === 'review-state') {
    return context.artifactKinds?.some(isDocumentOrCatalog) ?? false;
  }
  return [...context.graphFocus.values()].some((paths) =>
    paths.includes(diagnosticPath)
  );
}

function matchesFocus(
  diagnosticPath: string,
  context: DiagnosticFilterContext
): boolean {
  if (context.focus.paths.has(diagnosticPath)) {
    return true;
  }
  return [...context.focus.selectedArtifacts].some((selectedPath) =>
    (context.graphFocus.get(selectedPath) ?? []).includes(diagnosticPath)
  );
}

function isArtifactKind(
  category: ClassifiedFile['category']
): category is ArtifactKind {
  return (
    category === 'catalog' ||
    category === 'daemon' ||
    category === 'document' ||
    category === 'role' ||
    category === 'skill'
  );
}

function isDocumentOrCatalog(kind: string): boolean {
  return kind === 'document' || kind === 'catalog';
}
