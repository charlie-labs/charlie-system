import { afterEach, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../../runtime/deps.js';
import { ContentSetupError } from '../../setup-error.js';
import { SOURCE_REPOSITORY_SCAFFOLD_ROOT } from '../roots.js';
import { runSourceRepositorySetup } from '../source-repo.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

test('reads only the package scaffold for source-repository setup', async () => {
  const sourceRoot = await makeDirectory('source-repo-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    'repo-specific\nrepo-specific/__owner__\nrepo-specific/__owner__/__name__\n'
  );
  await mkdir(path.join(sourceRoot, '__owner__', '__name__'), {
    recursive: true,
  });
  await writeFile(
    path.join(sourceRoot, '__owner__', '__name__', 'README.md'),
    'repository: __repository_id__\n'
  );
  const baseFilesystem = createFlywheelDeps().filesystem;
  const manifestReads: string[] = [];
  const sourceByteReads: string[] = [];

  await runSourceRepositorySetup({
    destinationRoot,
    filesystem: {
      ...baseFilesystem,
      readFile: async (filePath) => {
        manifestReads.push(filePath);
        return baseFilesystem.readFile(filePath);
      },
      readFileBytes: async (filePath) => {
        sourceByteReads.push(filePath);
        return baseFilesystem.readFileBytes(filePath);
      },
    },
    repositoryId: 'acme/api',
    sourceRoot,
  });

  expect(manifestReads).toEqual([path.join(sourceRoot, 'DIRECTORIES')]);
  expect(sourceByteReads).toEqual([
    path.join(sourceRoot, '__owner__', '__name__', 'README.md'),
  ]);
});

test('materializes the production Repository entity and all source-repository roots', async () => {
  const destinationRoot = await makeDirectory('customer-repository');

  const first = await runSourceRepositorySetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    repositoryId: 'acme/api',
    sourceRoot: SOURCE_REPOSITORY_SCAFFOLD_ROOT,
  });
  const second = await runSourceRepositorySetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    repositoryId: 'acme/api',
    sourceRoot: SOURCE_REPOSITORY_SCAFFOLD_ROOT,
  });

  expect(first.validationPerformed).toBe(false);
  expect(first.copied).toContain('customer-wide/catalog/repositories.yaml');
  expect(second.copied).toEqual([]);
  expect(second.skipped).toContain('customer-wide/catalog/repositories.yaml');
  await Promise.all(
    [
      'repo-specific/acme/api/catalog',
      'repo-specific/acme/api/docs',
      'repo-specific/acme/api/.agents/daemons',
      'repo-specific/acme/api/.agents/skills',
    ].map(async (relativePath) => {
      expect(
        (await stat(path.join(destinationRoot, relativePath))).isDirectory()
      ).toBe(true);
    })
  );
  expect(
    await readFile(
      path.join(destinationRoot, 'customer-wide/catalog/repositories.yaml'),
      'utf8'
    )
  ).toBe(
    [
      'apiVersion: backstage.io/v1alpha1',
      'kind: Repository',
      'metadata:',
      '  name: acme/api',
      '  title: acme/api',
      '  description: Customer source repository tracked by Charlie.',
      '  annotations:',
      '    charlie.ai/review-every: 90d',
      'spec: {}',
      '',
    ].join('\n')
  );
});

test('rejects a symbolic-link directory manifest without following it', async () => {
  const sourceRoot = await makeDirectory('source-repo-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  const outsideManifest = path.join(
    await makeDirectory('outside'),
    'DIRECTORIES'
  );
  await writeFile(outsideManifest, 'repo-specific\n');
  await symlink(outsideManifest, path.join(sourceRoot, 'DIRECTORIES'));

  const error = await captureFailure(() =>
    runSourceRepositorySetup({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      repositoryId: 'acme/api',
      sourceRoot,
    })
  );

  expect(error).toBeInstanceOf(ContentSetupError);
  expect(error).toMatchObject({
    path: 'DIRECTORIES',
    reason: 'source directory manifest is not a regular file',
  });
  expect(await exists(path.join(destinationRoot, 'repo-specific'))).toBe(false);
});

async function makeDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(`/tmp/flywheel-setup-${name}-`);
  temporaryDirectories.push(directory);
  return directory;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await Bun.file(filePath).stat();
    return true;
  } catch {
    return false;
  }
}

async function captureFailure(
  operation: () => Promise<unknown>
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error('expected operation to fail');
}
