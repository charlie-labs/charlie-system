import {
  CUSTOMER_SCAFFOLD_ROOT,
  SOURCE_REPOSITORY_SCAFFOLD_ROOT,
} from '../../lib/content/setup/roots.js';
import { resolveRepositoryPath } from '../../lib/repository/path.js';
import {
  createFlywheelDeps,
  type AsyncFileSystem,
} from '../../lib/runtime/deps.js';

export type ContentSetupDeps = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly scaffoldRoot: string;
}>;

export function buildCustomerSetupDeps(): ContentSetupDeps {
  return buildSetupDeps(CUSTOMER_SCAFFOLD_ROOT);
}

export function buildSourceRepositorySetupDeps(): ContentSetupDeps {
  return buildSetupDeps(SOURCE_REPOSITORY_SCAFFOLD_ROOT);
}

export function resolveContentSetupDestination(
  explicitPath: string | undefined
): string {
  return resolveRepositoryPath({
    cwd: process.cwd(),
    ...(explicitPath === undefined ? {} : { explicitPath }),
  });
}

function buildSetupDeps(scaffoldRoot: string): ContentSetupDeps {
  return {
    filesystem: createFlywheelDeps().filesystem,
    scaffoldRoot,
  };
}
