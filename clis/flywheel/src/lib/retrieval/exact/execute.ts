import type {
  RepositoryInventory,
  RepositorySelection,
} from '../../repository/contract.js';
import type { ProcessResult, ProcessRunner } from '../../runtime/deps.js';
import type { ExactSearchPlan } from './contract.js';
import { ExactSearchOperationalError } from './errors.js';
import { planExactSearch } from './plan.js';

export async function runExactSearch(input: {
  readonly inventory: RepositoryInventory;
  readonly process: ProcessRunner;
  readonly rgArgs: readonly string[];
  readonly selection: RepositorySelection;
}): Promise<ProcessResult> {
  return executeExactSearch(
    input.process,
    planExactSearch(input.inventory, input.selection, input.rgArgs)
  );
}

async function executeExactSearch(
  process: ProcessRunner,
  plan: ExactSearchPlan
): Promise<ProcessResult> {
  if (plan.searchPaths.length === 0) {
    return { exitCode: 1, stderr: '', stdout: '' };
  }
  try {
    return await process.run('rg', plan.rgArgs, {
      cwd: plan.repositoryPath,
    });
  } catch (error) {
    throw new ExactSearchOperationalError('ripgrep could not be started', {
      cause: error,
    });
  }
}
