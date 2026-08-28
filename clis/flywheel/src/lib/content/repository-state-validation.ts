import type { AsyncFileSystem } from '../runtime/deps.js';
import { ContentOperationalError } from './errors.js';

export async function assertRepositoryDirectory(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): Promise<void> {
  try {
    const stats = await filesystem.stat(repositoryPath);
    if (!stats.isDirectory()) {
      throw new ContentOperationalError(
        `selected repository path is not a directory: ${repositoryPath}`
      );
    }
  } catch (error) {
    if (error instanceof ContentOperationalError) {
      throw error;
    }
    throw new ContentOperationalError(
      `cannot read selected repository: ${repositoryPath}`,
      { cause: error }
    );
  }
}
