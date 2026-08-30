import { afterEach, expect, test } from 'bun:test';
import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../runtime/deps.js';
import { discoverRepository } from '../discover.js';
import { RepositoryPathError, RepositorySourceError } from '../errors.js';
import { createWorkingTreeSource } from '../source/working-tree.js';
import {
  cleanupTemporaryDirectories,
  makeTemporaryDirectory,
  makeWorkingTree,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('lists normalized entries deterministically without traversing Git or symlinks', async () => {
  const repositoryPath = await makeWorkingTree({
    '.git/config': 'ignored\n',
    'customer-wide/docs/guide.md': 'guide\n',
    'roles/engineer.yaml': 'role\n',
  });
  const outsidePath = await makeTemporaryDirectory();
  await mkdir(path.join(outsidePath, 'nested'));
  await symlink(
    outsidePath,
    path.join(repositoryPath, 'customer-wide', 'docs', 'linked'),
    'dir'
  );
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath,
  });

  const entries = await source.listEntries();

  expect(entries).toEqual([
    { kind: 'directory', path: 'customer-wide' },
    { kind: 'directory', path: 'customer-wide/docs' },
    { kind: 'file', path: 'customer-wide/docs/guide.md' },
    { kind: 'symbolic-link', path: 'customer-wide/docs/linked' },
    { kind: 'directory', path: 'roles' },
    { kind: 'file', path: 'roles/engineer.yaml' },
  ]);
  expect(source.state).toEqual({
    kind: 'working-tree',
    repositoryPath,
  });
});

test('reads requested files as one ordered batch and reports missing files', async () => {
  const repositoryPath = await makeWorkingTree({
    'customer-wide/docs/a.md': 'alpha',
    'customer-wide/docs/b.md': 'beta',
  });
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath,
  });

  const results = await source.readFiles([
    'customer-wide/docs/b.md',
    'customer-wide/docs/missing.md',
    'customer-wide/docs/a.md',
  ]);

  expect(
    results.map((result) =>
      result.kind === 'read'
        ? [result.path, new TextDecoder().decode(result.bytes)]
        : [result.path, result.kind]
    )
  ).toEqual([
    ['customer-wide/docs/b.md', 'beta'],
    ['customer-wide/docs/missing.md', 'missing'],
    ['customer-wide/docs/a.md', 'alpha'],
  ]);
});

test('keeps filesystem names with backslashes visible as unsupported entries', async () => {
  const repositoryPath = await makeWorkingTree({
    'customer-wide/docs/weird\\name.md': 'visible but unsupported\n',
    'customer-wide/docs/weird\\directory/nested.md':
      'also visible but unsupported\n',
    'customer-wide/docs/regular.md': 'regular\n',
  });
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath,
  });

  const inventory = await discoverRepository(source);

  expect(inventory.entries).toContainEqual({
    kind: 'unsupported',
    path: 'customer-wide/docs/weird\\name.md',
    reason: 'unsupported-path',
    region: { kind: 'customer-wide' },
  });
  expect(inventory.entries).toContainEqual({
    kind: 'unsupported',
    path: 'customer-wide/docs/weird\\directory',
    reason: 'unsupported-path',
    region: { kind: 'customer-wide' },
  });
  expect(inventory.entries).toContainEqual({
    kind: 'unsupported',
    path: 'customer-wide/docs/weird\\directory/nested.md',
    reason: 'unsupported-path',
    region: { kind: 'customer-wide' },
  });
  expect(inventory.entries).toContainEqual({
    artifactKind: 'document',
    kind: 'artifact',
    path: 'customer-wide/docs/regular.md',
    region: { kind: 'customer-wide' },
  });
});

test('rejects paths outside the repository and non-regular files', async () => {
  const repositoryPath = await makeWorkingTree({
    'customer-wide/docs/guide.md': 'guide\n',
  });
  const linkPath = path.join(repositoryPath, 'customer-wide', 'docs', 'link');
  await symlink(path.join(repositoryPath, 'roles'), linkPath);
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath,
  });

  const outsideError = await captureError(source.readFiles(['../outside']));
  const linkError = await captureError(
    source.readFiles(['customer-wide/docs/link'])
  );

  expect(outsideError).toBeInstanceOf(RepositoryPathError);
  expect(linkError).toBeInstanceOf(RepositorySourceError);
});

test('rejects files reached through a symbolic-link directory', async () => {
  const repositoryPath = await makeWorkingTree({
    'customer-wide/docs/guide.md': 'guide\n',
  });
  const outsidePath = await makeWorkingTree({ 'secret.md': 'outside\n' });
  await symlink(
    outsidePath,
    path.join(repositoryPath, 'customer-wide', 'docs', 'linked'),
    'dir'
  );
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath,
  });

  const error = await captureError(
    source.readFiles(['customer-wide/docs/linked/secret.md'])
  );

  expect(error).toBeInstanceOf(RepositorySourceError);
});

test('reports an unreadable Flywheel repository root through the source boundary', async () => {
  const missingPath = path.join(
    await makeTemporaryDirectory(),
    'does-not-exist'
  );
  const source = createWorkingTreeSource({
    filesystem: createFlywheelDeps().filesystem,
    repositoryPath: missingPath,
  });

  const error = await captureError(source.listEntries());

  expect(error).toMatchObject({
    message: `cannot read selected Flywheel repository: ${missingPath}`,
    name: 'RepositorySourceError',
  });
});

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected operation to fail');
}
