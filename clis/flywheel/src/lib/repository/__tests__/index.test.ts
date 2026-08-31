/* eslint-disable max-lines-per-function */

import { afterEach, expect, test } from 'bun:test';
import { chmod, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../runtime/deps.js';
import type { FileReadResult } from '../contract.js';
import { createIndexSource } from '../source/index.js';
import { cleanupTemporaryDirectories, makeWorkingTree } from './test-utils.js';

const deps = createFlywheelDeps();

afterEach(cleanupTemporaryDirectories);

test('reads only the final staged index with private mode mapping', async () => {
  const repositoryPath = await makeWorkingTree({
    'customer-wide/docs/delete.md': 'delete me\n',
    'customer-wide/docs/guide.md': 'initial guide\n',
    'customer-wide/docs/rename.md': 'rename me\n',
    'customer-wide/docs/script.sh': 'echo initial\n',
  });
  await git(repositoryPath, ['init', '--quiet']);
  await git(repositoryPath, ['config', 'user.email', 'fixture@example.test']);
  await git(repositoryPath, ['config', 'user.name', 'Flywheel Fixture']);
  await git(repositoryPath, ['add', '--all']);

  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/guide.md'),
    'staged guide\n'
  );
  await chmod(path.join(repositoryPath, 'customer-wide/docs/script.sh'), 0o755);
  await rename(
    path.join(repositoryPath, 'customer-wide/docs/rename.md'),
    path.join(repositoryPath, 'customer-wide/docs/renamed.md')
  );
  await unlink(path.join(repositoryPath, 'customer-wide/docs/delete.md'));
  await symlink(
    'guide.md',
    path.join(repositoryPath, 'customer-wide/docs/link')
  );
  await git(repositoryPath, ['add', '--all']);

  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/guide.md'),
    'unstaged guide\n'
  );
  await writeFile(
    path.join(repositoryPath, 'customer-wide/docs/untracked.md'),
    'untracked content\n'
  );

  const source = createIndexSource({
    process: deps.process,
    repositoryPath,
  });
  const entries = await source.listEntries();
  const reads = await source.readFiles([
    'customer-wide/docs/guide.md',
    'customer-wide/docs/link',
    'customer-wide/docs/script.sh',
    'customer-wide/docs/untracked.md',
  ]);

  expect(source.state).toEqual({ kind: 'index', repositoryPath });
  expect(entries).toEqual([
    { kind: 'directory', path: 'customer-wide' },
    { kind: 'directory', path: 'customer-wide/docs' },
    { kind: 'file', path: 'customer-wide/docs/guide.md' },
    { kind: 'symbolic-link', path: 'customer-wide/docs/link' },
    { kind: 'file', path: 'customer-wide/docs/renamed.md' },
    { kind: 'file', path: 'customer-wide/docs/script.sh' },
  ]);
  expect(reads.map((result) => readText(result))).toEqual([
    ['customer-wide/docs/guide.md', 'staged guide\n'],
    ['customer-wide/docs/link', 'guide.md'],
    ['customer-wide/docs/script.sh', 'echo initial\n'],
    ['customer-wide/docs/untracked.md', 'missing'],
  ]);
});

function readText(result: FileReadResult): readonly [string, string] {
  if (result.kind === 'missing') return [result.path, result.kind];
  return [result.path, new TextDecoder().decode(result.bytes)];
}

async function git(
  repositoryPath: string,
  args: readonly string[]
): Promise<void> {
  const result = await deps.process.run('git', args, { cwd: repositoryPath });
  expect(result.exitCode).toBe(0);
}
