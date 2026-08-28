import type { Dirent } from 'node:fs';
import path from 'node:path';

import type { AsyncFileSystem, ProcessRunner } from '../runtime/deps.js';
import { ContentOperationalError } from './errors.js';
import { sortedCopy } from './ordering.js';
import { parseIndexFiles, parseTreeFiles } from './repository-state-parsers.js';
import { assertRepositoryDirectory } from './repository-state-validation.js';

const WORKING_TREE_ROOTS = [
  '.flywheel',
  'core',
  'customer-wide',
  'repo-specific',
  'roles',
] as const;

type RepositoryStateKind = 'working-tree' | 'index' | 'commit' | 'prospective';

export type RepositoryFile = Readonly<{
  readonly mode: number;
  readonly path: string;
  readonly stage?: number;
}>;

export type RepositoryState = Readonly<{
  readonly kind: RepositoryStateKind;
  readonly listFiles: () => Promise<readonly RepositoryFile[]>;
  readonly readFile: (filePath: string) => Promise<string>;
}>;

export type RepositoryStateInput = Readonly<{
  readonly filesystem: AsyncFileSystem;
  readonly process: ProcessRunner;
  readonly repositoryPath: string;
  readonly state?: ValidationRepositoryState;
}>;

export type ValidationRepositoryState =
  | Readonly<{ readonly kind: 'working-tree' }>
  | Readonly<{ readonly kind: 'index' }>
  | Readonly<{ readonly kind: 'commit'; readonly ref: string }>
  | Readonly<{
      readonly base: RepositoryState;
      readonly changes: readonly ProspectiveFileChange[];
      readonly kind: 'prospective';
    }>;

export type ProspectiveFileChange = Readonly<{
  readonly content?: string;
  readonly deleted?: boolean;
  readonly mode?: number;
  readonly path: string;
}>;

export function createRepositoryState(
  input: RepositoryStateInput
): RepositoryState {
  const state = input.state ?? { kind: 'working-tree' };
  if (state.kind === 'working-tree') {
    return createWorkingTreeState(input.filesystem, input.repositoryPath);
  }
  if (state.kind === 'index') {
    return createIndexState(
      input.filesystem,
      input.process,
      input.repositoryPath
    );
  }
  if (state.kind === 'commit') {
    return createCommitState(input.process, input.repositoryPath, state.ref);
  }
  return createProspectiveRepositoryState(state.base, state.changes);
}

function createProspectiveRepositoryState(
  base: RepositoryState,
  changes: readonly ProspectiveFileChange[]
): RepositoryState {
  return createProspectiveState(base, changes);
}

function createWorkingTreeState(
  filesystem: AsyncFileSystem,
  repositoryPath: string
): RepositoryState {
  return {
    kind: 'working-tree',
    listFiles: async () => {
      await assertRepositoryDirectory(filesystem, repositoryPath);
      const roots = await Promise.all(
        WORKING_TREE_ROOTS.map(async (root) => {
          const absolutePath = path.join(repositoryPath, root);
          try {
            const stats = await filesystem.lstat(absolutePath);
            if (stats.isDirectory()) {
              return await walkWorkingTree(filesystem, absolutePath, root);
            }
            return [{ path: root, mode: modeFromStats(stats.mode) }];
          } catch (error) {
            if (isMissing(error)) {
              return [];
            }
            throw new ContentOperationalError(
              `cannot inspect repository state at ${root}`,
              { cause: error }
            );
          }
        })
      );
      return sortFiles(roots.flat());
    },
    readFile: (filePath) =>
      filesystem.readFile(path.join(repositoryPath, filePath)),
  };
}

async function walkWorkingTree(
  filesystem: AsyncFileSystem,
  absoluteDirectory: string,
  relativeDirectory: string
): Promise<readonly RepositoryFile[]> {
  let entries: Dirent[];
  try {
    entries = await filesystem.readdir(absoluteDirectory);
  } catch (error) {
    throw new ContentOperationalError(
      `cannot discover repository state at ${relativeDirectory}`,
      { cause: error }
    );
  }

  const children = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        return walkWorkingTree(filesystem, absolutePath, relativePath);
      }
      if (entry.isSymbolicLink()) {
        return [{ path: relativePath, mode: 0o120000 }];
      }
      let stats;
      try {
        stats = await filesystem.lstat(absolutePath);
      } catch (error) {
        throw new ContentOperationalError(
          `cannot inspect repository file at ${relativePath}`,
          { cause: error }
        );
      }
      return [{ path: relativePath, mode: modeFromStats(stats.mode) }];
    })
  );
  return children.flat();
}

function createIndexState(
  _filesystem: AsyncFileSystem,
  process: ProcessRunner,
  repositoryPath: string
): RepositoryState {
  return {
    kind: 'index',
    listFiles: async () => {
      const result = await runGit(process, repositoryPath, [
        'ls-files',
        '--cached',
        '--stage',
        '-z',
      ]);
      return sortFiles(parseIndexFiles(result));
    },
    readFile: async (filePath) => {
      const result = await runGit(process, repositoryPath, [
        'show',
        `:${filePath}`,
      ]);
      return result.stdout;
    },
  };
}

function createCommitState(
  process: ProcessRunner,
  repositoryPath: string,
  ref: string
): RepositoryState {
  return {
    kind: 'commit',
    listFiles: async () => {
      const result = await runGit(process, repositoryPath, [
        'ls-tree',
        '-r',
        '--full-tree',
        '-z',
        ref,
      ]);
      return sortFiles(parseTreeFiles(result));
    },
    readFile: async (filePath) => {
      const result = await runGit(process, repositoryPath, [
        'show',
        `${ref}:${filePath}`,
      ]);
      return result.stdout;
    },
  };
}

function createProspectiveState(
  base: RepositoryState,
  changes: readonly ProspectiveFileChange[]
): RepositoryState {
  const updates = new Map(changes.map((change) => [change.path, change]));
  return {
    kind: 'prospective',
    listFiles: async () => {
      const baseFiles = await base.listFiles();
      const files = new Map(baseFiles.map((file) => [file.path, file]));
      for (const change of changes) {
        if (isDeletedChange(change)) {
          files.delete(change.path);
        } else {
          files.set(change.path, {
            mode: change.mode ?? files.get(change.path)?.mode ?? 0o100644,
            path: change.path,
          });
        }
      }
      return sortFiles([...files.values()]);
    },
    readFile: async (filePath) => {
      const update = updates.get(filePath);
      if (update?.content !== undefined) {
        return update.content;
      }
      if (update !== undefined && isDeletedChange(update)) {
        throw new ContentOperationalError(
          `prospective repository file was deleted: ${filePath}`
        );
      }
      return base.readFile(filePath);
    },
  };
}

async function runGit(
  process: ProcessRunner,
  repositoryPath: string,
  args: readonly string[]
) {
  const result = await process.run('git', args, { cwd: repositoryPath });
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim();
    throw new ContentOperationalError(
      detail === ''
        ? `git ${args[0] ?? 'command'} failed with status ${result.exitCode}`
        : `git ${args[0] ?? 'command'} failed: ${detail}`
    );
  }
  return result;
}

function sortFiles(
  files: readonly RepositoryFile[]
): readonly RepositoryFile[] {
  return sortedCopy(files, (left, right) =>
    left.path.localeCompare(right.path)
  );
}

function modeFromStats(mode: number): number {
  return (mode & 0o170000) === 0o120000 ? 0o120000 : mode;
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function isDeletedChange(change: ProspectiveFileChange): boolean {
  return (
    change.deleted === true ||
    (change.content === undefined && change.mode === undefined)
  );
}
