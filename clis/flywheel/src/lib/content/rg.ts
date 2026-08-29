import { discoverRepository } from '../repository/discover.js';
import {
  RepositoryIdentityError,
  RepositoryPathError,
  RepositorySelectionError,
  RepositorySourceError,
} from '../repository/errors.js';
import { createRepositorySelection } from '../repository/selection.js';
import { createWorkingTreeSource } from '../repository/source/working-tree.js';
import {
  ExactSearchInvocationError,
  ExactSearchOperationalError,
} from '../retrieval/exact/errors.js';
import { runExactSearch } from '../retrieval/exact/execute.js';
import type {
  AsyncFileSystem,
  ProcessResult,
  ProcessRunner,
} from '../runtime/deps.js';
import { ContentInvocationError, ContentOperationalError } from './errors.js';

export type ContentRgInput = Readonly<{
  readonly customerWideOnly: boolean;
  readonly filesystem: AsyncFileSystem;
  readonly process: ProcessRunner;
  readonly repositoryIds: readonly string[];
  readonly repositoryPath: string;
  readonly rgArgs: readonly string[];
}>;

export async function runContentRg(
  input: ContentRgInput
): Promise<ProcessResult> {
  try {
    const source = createWorkingTreeSource({
      filesystem: input.filesystem,
      repositoryPath: input.repositoryPath,
    });
    const inventory = await discoverRepository(source);
    const selection = createRepositorySelection({
      customerWideOnly: input.customerWideOnly,
      repositoryIds: input.repositoryIds,
    });
    return await runExactSearch({
      inventory,
      process: input.process,
      rgArgs: input.rgArgs,
      selection,
    });
  } catch (error) {
    throw mapContentRgError(error);
  }
}

function mapContentRgError(error: unknown): Error {
  if (
    error instanceof ExactSearchInvocationError ||
    error instanceof RepositoryIdentityError ||
    error instanceof RepositoryPathError ||
    error instanceof RepositorySelectionError
  ) {
    return new ContentInvocationError(error.message);
  }
  if (
    error instanceof ExactSearchOperationalError ||
    error instanceof RepositorySourceError
  ) {
    return new ContentOperationalError(error.message, { cause: error });
  }
  return error instanceof Error
    ? error
    : new ContentOperationalError('content rg failed unexpectedly', {
        cause: error,
      });
}
