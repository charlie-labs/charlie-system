import { RepositorySourceError } from '../repository/errors.js';
import { createIndexSource } from '../repository/source/index.js';
import { createWorkingTreeSource } from '../repository/source/working-tree.js';
import type { AsyncFileSystem, ProcessRunner } from '../runtime/deps.js';
import { compileAndAssessRepository } from '../validation/assess.js';
import { ContentOperationalError } from './errors.js';
import type { ContentValidationResult } from './validation-contract.js';
import {
  resolveValidationSelection,
  selectedFileCount,
  selectValidationReport,
} from './validation-selection.js';

export type ContentValidationInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly paths: readonly string[];
  readonly process?: ProcessRunner;
  readonly repositoryPath: string;
  readonly staged?: boolean;
}>;

export async function runContentValidation(
  input: ContentValidationInput
): Promise<ContentValidationResult> {
  try {
    let source;
    if (input.staged === true) {
      if (input.process === undefined) {
        throw new ContentOperationalError(
          'staged content validation requires process dependencies'
        );
      }
      source = createIndexSource({
        process: input.process,
        repositoryPath: input.repositoryPath,
      });
    } else {
      source = createWorkingTreeSource({
        filesystem: input.filesystem,
        repositoryPath: input.repositoryPath,
      });
    }
    const repository = await compileAndAssessRepository(source);
    const selection = resolveValidationSelection({
      inventory: repository.projection.inventory,
      repositoryPath: input.repositoryPath,
      requestedPaths: input.paths,
    });
    const validation = selectValidationReport(repository.validation, selection);
    return {
      diagnostics: validation.diagnostics,
      filesChecked: selectedFileCount(
        repository.projection.inventory,
        selection
      ),
      status: validation.status,
    };
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      throw new ContentOperationalError(error.message, { cause: error });
    }
    throw error instanceof Error
      ? error
      : new ContentOperationalError('content validate failed unexpectedly', {
          cause: error,
        });
  }
}
