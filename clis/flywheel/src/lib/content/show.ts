import { RepositorySourceError } from '../repository/errors.js';
import { createWorkingTreeSource } from '../repository/source/working-tree.js';
import type { ArtifactInspection } from '../retrieval/inspection/contract.js';
import { inspectArtifact } from '../retrieval/inspection/execute.js';
import type { AsyncFileSystem } from '../runtime/deps.js';
import { ContentOperationalError } from './errors.js';

export async function runContentShow(input: {
  readonly filesystem: AsyncFileSystem;
  readonly repositoryPath: string;
  readonly target: string;
}): Promise<ArtifactInspection> {
  try {
    const source = createWorkingTreeSource({
      filesystem: input.filesystem,
      repositoryPath: input.repositoryPath,
    });
    return await inspectArtifact({ source, target: input.target });
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      throw new ContentOperationalError(error.message, { cause: error });
    }
    throw error instanceof Error
      ? error
      : new ContentOperationalError('content show failed unexpectedly', {
          cause: error,
        });
  }
}
