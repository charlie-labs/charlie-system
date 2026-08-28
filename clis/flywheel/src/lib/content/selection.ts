import path from 'node:path';

import type { AsyncFileSystem } from '../runtime/deps.js';
import { ContentInvocationError, ContentOperationalError } from './errors.js';

export async function assertSelectedRepositories(
  filesystem: AsyncFileSystem,
  repositoryPath: string,
  repositoryIds: readonly string[]
): Promise<void> {
  await Promise.all(
    repositoryIds.map(async (repositoryId) => {
      const selectedPath = path.join(
        repositoryPath,
        'repo-specific',
        repositoryId
      );
      try {
        const stats = await filesystem.stat(selectedPath);
        if (!stats.isDirectory()) {
          throw new ContentInvocationError(
            `selected repository does not exist: ${repositoryId}`
          );
        }
      } catch (error) {
        if (error instanceof ContentInvocationError) {
          throw error;
        }
        if (isMissing(error)) {
          throw new ContentInvocationError(
            `selected repository does not exist: ${repositoryId}`
          );
        }
        throw new ContentOperationalError(
          `cannot inspect selected repository: ${repositoryId}`,
          { cause: error }
        );
      }
    })
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
