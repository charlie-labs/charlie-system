/* eslint-disable no-await-in-loop */

import path from 'node:path';

import type { ProcessRunner } from '../../runtime/deps.js';
import type {
  FileReadResult,
  RepositoryPath,
  RepositorySource,
  RepositorySourceEntry,
  RepositoryState,
} from '../contract.js';
import { RepositorySourceError } from '../errors.js';
import { sortedCopy } from '../ordering.js';
import { resolveRepositoryEntryPath } from '../path.js';

export type IndexSourceOptions = Readonly<{
  readonly process: ProcessRunner;
  readonly repositoryPath: string;
}>;

export function createIndexSource({
  process,
  repositoryPath,
}: IndexSourceOptions): RepositorySource {
  const normalizedRoot = path.resolve(repositoryPath);
  const state: RepositoryState = {
    kind: 'index',
    repositoryPath: normalizedRoot,
  };
  return {
    state,
    listEntries: () => listIndexEntries(process, normalizedRoot),
    readFiles: (paths) => readIndexFiles(process, normalizedRoot, paths),
  };
}

async function listIndexEntries(
  process: ProcessRunner,
  repositoryPath: string
): Promise<readonly RepositorySourceEntry[]> {
  const result = await runGitText(process, repositoryPath, [
    'ls-files',
    '--cached',
    '--stage',
    '-z',
  ]);
  const files: RepositorySourceEntry[] = [];
  const directories = new Set<string>();
  for (const item of parseIndex(result.stdout)) {
    files.push({ kind: modeKind(item.mode), path: item.path });
    const segments = item.path.split('/');
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join('/'));
    }
  }
  const directoryEntries = sortedCopy(
    [...directories].map((entry) => ({
      kind: 'directory' as const,
      path: entry,
    })),
    comparePaths
  );
  return [...directoryEntries, ...sortedCopy(files, comparePaths)];
}

async function readIndexFiles(
  process: ProcessRunner,
  repositoryPath: string,
  paths: readonly RepositoryPath[]
): Promise<readonly FileReadResult[]> {
  const results: FileReadResult[] = [];
  for (const repositoryFilePath of paths) {
    results.push(
      await readIndexFile(process, repositoryPath, repositoryFilePath)
    );
  }
  return results;
}

async function readIndexFile(
  process: ProcessRunner,
  repositoryPath: string,
  repositoryFilePath: RepositoryPath
): Promise<FileReadResult> {
  resolveRepositoryEntryPath(repositoryPath, repositoryFilePath);
  const result = await runGitBytes(process, repositoryPath, [
    'show',
    `:${repositoryFilePath}`,
  ]);
  if (result.exitCode !== 0) {
    if (isMissingIndexPath(result.stderr)) {
      return { kind: 'missing', path: repositoryFilePath };
    }
    throw gitError(
      ['show', `:${repositoryFilePath}`],
      result.stderr,
      result.exitCode
    );
  }
  return { bytes: result.stdout, kind: 'read', path: repositoryFilePath };
}

type IndexItem = Readonly<{ readonly mode: number; readonly path: string }>;

function parseIndex(stdout: string): readonly IndexItem[] {
  const items: IndexItem[] = [];
  for (const record of stdout.split('\0')) {
    if (record === '') continue;
    const tab = record.indexOf('\t');
    if (tab < 0)
      throw new RepositorySourceError('git index output is malformed');
    const header = record.slice(0, tab).split(/\s+/u);
    const mode = Number.parseInt(header[0] ?? '', 8);
    const stage = Math.trunc(Number(header[2] ?? ''));
    const filePath = record.slice(tab + 1);
    if (!Number.isInteger(mode) || filePath === '') {
      throw new RepositorySourceError('git index output is malformed');
    }
    if (stage !== 0) {
      throw new RepositorySourceError(
        `git index contains an unmerged path: ${filePath}`
      );
    }
    items.push({ mode, path: filePath });
  }
  return items;
}

function modeKind(mode: number): RepositorySourceEntry['kind'] {
  if (mode === 0o100644 || mode === 0o100755) return 'file';
  if (mode === 0o120000) return 'symbolic-link';
  return 'other';
}

async function runGitText(
  process: ProcessRunner,
  repositoryPath: string,
  args: readonly string[]
): Promise<Readonly<{ readonly stderr: string; readonly stdout: string }>> {
  const result = await process.run('git', args, { cwd: repositoryPath });
  if (result.exitCode !== 0)
    throw gitError(args, result.stderr, result.exitCode);
  return result;
}

async function runGitBytes(
  process: ProcessRunner,
  repositoryPath: string,
  args: readonly string[]
): Promise<
  Readonly<{
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: Uint8Array;
  }>
> {
  if (process.runBytes === undefined) {
    throw new RepositorySourceError('Git byte plumbing is unavailable');
  }
  return process.runBytes('git', args, { cwd: repositoryPath });
}

function isMissingIndexPath(stderr: string): boolean {
  return (
    stderr.includes('does not exist (neither on disk nor in the index)') ||
    stderr.includes('exists on disk, but not in the index')
  );
}

function gitError(
  args: readonly string[],
  stderr: string,
  exitCode: number
): RepositorySourceError {
  const detail = stderr.trim();
  return new RepositorySourceError(
    detail === ''
      ? `git ${args[0] ?? 'command'} failed with status ${exitCode}`
      : `git ${args[0] ?? 'command'} failed: ${detail}`
  );
}

function comparePaths(
  left: RepositorySourceEntry,
  right: RepositorySourceEntry
): number {
  return left.path.localeCompare(right.path);
}
