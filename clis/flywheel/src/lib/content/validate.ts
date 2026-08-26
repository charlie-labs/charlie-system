import type { Dirent } from 'node:fs';
import path from 'node:path';

import type { AsyncFileSystem } from '../runtime/deps.js';
import {
  formatDiagnostic,
  makeDiagnostic,
  sortDiagnostics,
} from './diagnostics.js';
import {
  ContentInvocationError,
  ContentOperationalError,
  type ContentDiagnostic,
} from './errors.js';
import { validateFile } from './files.js';
import { sortedCopy } from './ordering.js';
import {
  discoverValidationRoots,
  resolveValidationPath,
  toRepositoryRelative,
} from './roots.js';

export type ContentValidationInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly paths: readonly string[];
  readonly repositoryPath: string;
}>;

export type ContentValidationResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly filesChecked: number;
}>;

type ContentFile = Readonly<{
  readonly absolutePath: string;
  readonly relativePath: string;
}>;

type DiscoveryContext = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly repositoryPath: string;
}>;

type DiscoveryResult = Readonly<{
  readonly diagnostics: readonly ContentDiagnostic[];
  readonly files: readonly ContentFile[];
}>;

export { formatDiagnostic };

export async function validateContent(
  input: ContentValidationInput
): Promise<ContentValidationResult> {
  const discovery = await discoverFiles(input);
  const validations = await Promise.all(
    discovery.files.map((file) => validateFile(input.filesystem, file))
  );
  const diagnostics = [...discovery.diagnostics, ...validations.flat()];
  return {
    diagnostics: sortDiagnostics(diagnostics),
    filesChecked: discovery.files.length,
  };
}

async function discoverFiles(
  input: ContentValidationInput
): Promise<DiscoveryResult> {
  const roots =
    input.paths.length === 0
      ? await discoverValidationRoots(input.filesystem, input.repositoryPath)
      : await resolveRequestedPaths(input);
  const context = {
    filesystem: input.filesystem,
    repositoryPath: input.repositoryPath,
  } satisfies DiscoveryContext;
  const results = await Promise.all(
    roots.map((root) => collectFiles(root, context))
  );
  return {
    diagnostics: results.flatMap((result) => result.diagnostics),
    files: sortedCopy(
      results.flatMap((result) => result.files),
      (left, right) => left.relativePath.localeCompare(right.relativePath)
    ),
  };
}

async function resolveRequestedPaths(
  input: ContentValidationInput
): Promise<readonly string[]> {
  const resolved = await Promise.all(
    input.paths.map(async (requestedPath) => {
      const absolutePath = resolveValidationPath(
        input.repositoryPath,
        requestedPath
      );
      try {
        await input.filesystem.stat(absolutePath);
        return absolutePath;
      } catch (error) {
        if (isMissing(error)) {
          throw new ContentInvocationError(
            `selected repository path does not exist: ${requestedPath}`
          );
        }
        throw new ContentOperationalError(
          `cannot inspect selected path: ${requestedPath}`,
          { cause: error }
        );
      }
    })
  );
  return sortedCopy([...new Set(resolved)], (left, right) =>
    left.localeCompare(right)
  );
}

async function collectFiles(
  directoryPath: string,
  context: DiscoveryContext
): Promise<DiscoveryResult> {
  let entries: Dirent[];
  try {
    entries = await context.filesystem.readdir(directoryPath);
  } catch (error) {
    if (isNotDirectory(error)) {
      return {
        diagnostics: [],
        files: [
          {
            absolutePath: directoryPath,
            relativePath: toRepositoryRelative(
              context.repositoryPath,
              directoryPath
            ),
          },
        ],
      };
    }
    throw new ContentOperationalError(
      `cannot discover content under ${toRepositoryRelative(
        context.repositoryPath,
        directoryPath
      )}`,
      { cause: error }
    );
  }

  const results = await Promise.all(
    entries.map((entry) => collectEntry(directoryPath, entry, context))
  );
  return {
    diagnostics: results.flatMap((result) => result.diagnostics),
    files: results.flatMap((result) => result.files),
  };
}

async function collectEntry(
  directoryPath: string,
  entry: Dirent,
  context: DiscoveryContext
): Promise<DiscoveryResult> {
  const absolutePath = path.join(directoryPath, entry.name);
  const relativePath = toRepositoryRelative(
    context.repositoryPath,
    absolutePath
  );
  if (entry.isSymbolicLink()) {
    return {
      diagnostics: [
        makeDiagnostic({
          message: 'symbolic links are not supported in governed content roots',
          path: relativePath,
          ruleId: 'FW-PATH-001',
        }),
      ],
      files: [],
    };
  }
  if (entry.isDirectory()) {
    return collectFiles(absolutePath, context);
  }
  return {
    diagnostics: [],
    files: [{ absolutePath, relativePath }],
  };
}

function isMissing(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT');
}

function isNotDirectory(error: unknown): boolean {
  return hasErrorCode(error, 'ENOTDIR');
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
