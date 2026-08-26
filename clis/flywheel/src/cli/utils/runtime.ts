import { resolveRepositoryPath } from '../../lib/repository/path.js';
import {
  createFlywheelDeps,
  type FlywheelDeps,
} from '../../lib/runtime/deps.js';

export type FlywheelRuntime = Readonly<{
  readonly repositoryPath: string;
  readonly deps: FlywheelDeps;
}>;

export type FlywheelRuntimeOptions = Readonly<{
  readonly cwd: string;
  readonly deps?: FlywheelDeps;
  readonly repositoryPath?: string;
}>;

export function buildFlywheelRuntime(
  options: FlywheelRuntimeOptions
): FlywheelRuntime {
  return {
    repositoryPath: resolveRepositoryPath({
      cwd: options.cwd,
      ...(options.repositoryPath === undefined
        ? {}
        : { explicitPath: options.repositoryPath }),
    }),
    deps: options.deps ?? createFlywheelDeps(),
  };
}
