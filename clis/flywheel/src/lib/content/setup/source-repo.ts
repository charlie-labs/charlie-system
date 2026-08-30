import path from 'node:path';

import { normalizeRepositoryId } from '../../repository/identity.js';
import { ContentInvocationError } from '../errors.js';
import { ContentSetupError } from '../setup-error.js';
import type {
  ScaffoldCopyInput,
  ScaffoldDirectoryManifest,
  ScaffoldCopyTransform,
  SetupResult,
} from './contract.js';
import { copyScaffoldTree } from './copy.js';

const DIRECTORY_MANIFEST_PATH = 'DIRECTORIES';

export type SourceRepositorySetupInput = Readonly<
  ScaffoldCopyInput & {
    readonly repositoryId: string;
  }
>;

export async function runSourceRepositorySetup(
  input: SourceRepositorySetupInput
): Promise<SetupResult> {
  const repositoryId = normalizeRepositoryIdOrThrow(input.repositoryId);
  const transform = createSourceRepositoryTransform(repositoryId);
  const directoryManifest = await readDirectoryManifest(input);
  const result = await copyScaffoldTree({
    ...input,
    directoryManifest,
    transform,
  });
  return { ...result, validationPerformed: false };
}

async function readDirectoryManifest(
  input: SourceRepositorySetupInput
): Promise<ScaffoldDirectoryManifest> {
  const sourcePath = path.join(input.sourceRoot, DIRECTORY_MANIFEST_PATH);
  let sourceStats: Awaited<
    ReturnType<SourceRepositorySetupInput['filesystem']['lstat']>
  >;
  try {
    sourceStats = await input.filesystem.lstat(sourcePath);
  } catch (error) {
    throw new ContentSetupError(
      DIRECTORY_MANIFEST_PATH,
      `source directory manifest cannot be inspected: ${errorMessage(error)}`,
      { copied: [], skipped: [] },
      { cause: error }
    );
  }
  if (!sourceStats.isFile()) {
    throw new ContentSetupError(
      DIRECTORY_MANIFEST_PATH,
      'source directory manifest is not a regular file',
      { copied: [], skipped: [] }
    );
  }
  let contents: string;
  try {
    contents = await input.filesystem.readFile(sourcePath);
  } catch (error) {
    throw new ContentSetupError(
      DIRECTORY_MANIFEST_PATH,
      `source directory manifest cannot be read: ${errorMessage(error)}`,
      { copied: [], skipped: [] },
      { cause: error }
    );
  }
  const directories = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (directories.length === 0) {
    throw new ContentSetupError(
      DIRECTORY_MANIFEST_PATH,
      'source directory manifest is empty',
      { copied: [], skipped: [] }
    );
  }
  return { directories, sourcePath: DIRECTORY_MANIFEST_PATH };
}

function normalizeRepositoryIdOrThrow(candidate: string): string {
  try {
    return normalizeRepositoryId(candidate);
  } catch (error) {
    throw new ContentInvocationError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

function createSourceRepositoryTransform(
  repositoryId: string
): ScaffoldCopyTransform {
  const [owner, name] = repositoryId.split('/');
  return {
    destinationPath: (sourcePath) =>
      sourcePath
        .replaceAll('__owner__', owner ?? '')
        .replaceAll('__name__', name ?? ''),
    fileBytes: (_sourcePath, bytes) => substituteText(bytes, repositoryId),
  };
}

function substituteText(bytes: Uint8Array, repositoryId: string): Uint8Array {
  const [owner, name] = repositoryId.split('/');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bytes;
  }
  const substituted = text
    .replaceAll('__owner__', owner ?? '')
    .replaceAll('__name__', name ?? '')
    .replaceAll('__repository_id__', repositoryId);
  return substituted === text ? bytes : new TextEncoder().encode(substituted);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
