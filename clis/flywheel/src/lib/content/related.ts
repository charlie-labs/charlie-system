import { RepositorySourceError } from '../repository/errors.js';
import { createWorkingTreeSource } from '../repository/source/working-tree.js';
import type { RelatedResult } from '../retrieval/related/contract.js';
import { retrieveRelated } from '../retrieval/related/execute.js';
import type { AsyncFileSystem } from '../runtime/deps.js';
import { ContentOperationalError } from './errors.js';

export async function runContentRelated(input: {
  readonly filesystem: AsyncFileSystem;
  readonly repositoryPath: string;
  readonly target: string;
}): Promise<RelatedResult> {
  try {
    const source = createWorkingTreeSource({
      filesystem: input.filesystem,
      repositoryPath: input.repositoryPath,
    });
    return await retrieveRelated({ source, target: input.target });
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      throw new ContentOperationalError(error.message, { cause: error });
    }
    throw error instanceof Error
      ? error
      : new ContentOperationalError('content related failed unexpectedly', {
          cause: error,
        });
  }
}
