import { afterEach, expect, test } from 'bun:test';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../../runtime/deps.js';
import { ContentSetupError } from '../../setup-error.js';
import { runCustomerSetup } from '../customer.js';
import {
  CUSTOMER_SCAFFOLD_ROOT,
  SOURCE_REPOSITORY_SCAFFOLD_ROOT,
} from '../roots.js';
import { runSourceRepositorySetup } from '../source-repo.js';

const temporaryDirectories: string[] = [];

const CUSTOMER_MARKERS = [
  '.flywheel/.gitkeep',
  'customer-wide/.agents/daemons/pr-review/.gitkeep',
  'customer-wide/.agents/skills/.gitkeep',
  'customer-wide/catalog/.gitkeep',
  'customer-wide/docs/.gitkeep',
  'roles/.gitkeep',
] as const;

const SOURCE_REPOSITORY_MARKERS = [
  '.flywheel/.gitkeep',
  'customer-wide/.agents/daemons/.gitkeep',
  'customer-wide/.agents/skills/.gitkeep',
  'customer-wide/catalog/.gitkeep',
  'customer-wide/docs/.gitkeep',
  'repo-specific/acme/api/.agents/daemons/.gitkeep',
  'repo-specific/acme/api/.agents/skills/.gitkeep',
  'repo-specific/acme/api/catalog/.gitkeep',
  'repo-specific/acme/api/docs/.gitkeep',
] as const;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

test('reads only the package directory manifest for both setup commands', async () => {
  const customerSourceRoot = await makeDirectory('customer-scaffold');
  const sourceRepositorySourceRoot = await makeDirectory(
    'source-repo-scaffold'
  );
  const destinationRoot = await makeDirectory('customer-repository');
  await writeFile(
    path.join(customerSourceRoot, 'DIRECTORIES'),
    'customer-wide\n'
  );
  await writeFile(
    path.join(sourceRepositorySourceRoot, 'DIRECTORIES'),
    'repo-specific\n'
  );
  await writeFile(path.join(customerSourceRoot, 'content.md'), 'do not read');
  await writeFile(
    path.join(sourceRepositorySourceRoot, 'content.md'),
    'do not read'
  );
  const baseFilesystem = createFlywheelDeps().filesystem;
  const manifestReads: string[] = [];

  const filesystem = {
    ...baseFilesystem,
    readFile: async (filePath: string) => {
      manifestReads.push(filePath);
      return baseFilesystem.readFile(filePath);
    },
    readFileBytes: failIfContentRead,
  };

  await runCustomerSetup({
    destinationRoot,
    filesystem,
    sourceRoot: customerSourceRoot,
  });
  await runSourceRepositorySetup({
    destinationRoot,
    filesystem,
    repositoryId: 'acme/api',
    sourceRoot: sourceRepositorySourceRoot,
  });

  expect(manifestReads).toEqual([
    path.join(customerSourceRoot, 'DIRECTORIES'),
    path.join(sourceRepositorySourceRoot, 'DIRECTORIES'),
  ]);
});

test('materializes the production customer directory tree and remains create-only', async () => {
  const destinationRoot = await makeDirectory('customer-repository');

  const first = await runCustomerSetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot: CUSTOMER_SCAFFOLD_ROOT,
  });
  const second = await runCustomerSetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot: CUSTOMER_SCAFFOLD_ROOT,
  });

  expect(first.validationPerformed).toBe(false);
  expect(first.copied).toEqual([
    '.flywheel',
    '.flywheel/.gitkeep',
    'customer-wide',
    'customer-wide/.agents',
    'customer-wide/.agents/daemons',
    'customer-wide/.agents/daemons/pr-review',
    'customer-wide/.agents/daemons/pr-review/.gitkeep',
    'customer-wide/.agents/skills',
    'customer-wide/.agents/skills/.gitkeep',
    'customer-wide/catalog',
    'customer-wide/catalog/.gitkeep',
    'customer-wide/docs',
    'customer-wide/docs/.gitkeep',
    'roles',
    'roles/.gitkeep',
  ]);
  expect(first.skipped).toEqual([]);
  expect(second.copied).toEqual([]);
  expect(second.skipped).toEqual(first.copied);
  expect(await filePaths(destinationRoot)).toEqual([...CUSTOMER_MARKERS]);
  await expectDirectories(
    destinationRoot,
    first.copied.filter(isDirectoryPath)
  );
  await expectEmptyFiles(destinationRoot, CUSTOMER_MARKERS);
});

test('materializes the production source-repository directory tree with Git markers', async () => {
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
  expect(first.copied).toEqual([
    '.flywheel',
    '.flywheel/.gitkeep',
    'customer-wide',
    'customer-wide/.agents',
    'customer-wide/.agents/daemons',
    'customer-wide/.agents/daemons/.gitkeep',
    'customer-wide/.agents/skills',
    'customer-wide/.agents/skills/.gitkeep',
    'customer-wide/catalog',
    'customer-wide/catalog/.gitkeep',
    'customer-wide/docs',
    'customer-wide/docs/.gitkeep',
    'repo-specific',
    'repo-specific/acme',
    'repo-specific/acme/api',
    'repo-specific/acme/api/.agents',
    'repo-specific/acme/api/.agents/daemons',
    'repo-specific/acme/api/.agents/daemons/.gitkeep',
    'repo-specific/acme/api/.agents/skills',
    'repo-specific/acme/api/.agents/skills/.gitkeep',
    'repo-specific/acme/api/catalog',
    'repo-specific/acme/api/catalog/.gitkeep',
    'repo-specific/acme/api/docs',
    'repo-specific/acme/api/docs/.gitkeep',
  ]);
  expect(first.skipped).toEqual([]);
  expect(second.copied).toEqual([]);
  expect(second.skipped).toEqual(first.copied);
  expect(await filePaths(destinationRoot)).toEqual([
    ...SOURCE_REPOSITORY_MARKERS,
  ]);
  await expectDirectories(
    destinationRoot,
    first.copied.filter(isDirectoryPath)
  );
  await expectEmptyFiles(destinationRoot, SOURCE_REPOSITORY_MARKERS);
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
  expect(await filePaths(destinationRoot)).toEqual([]);
});

async function makeDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(`/tmp/flywheel-setup-${name}-`);
  temporaryDirectories.push(directory);
  return directory;
}

function failIfContentRead(_filePath: string): Promise<Uint8Array> {
  throw new Error('content files must not be read');
}

async function expectDirectories(
  root: string,
  relativePaths: readonly string[]
): Promise<void> {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      expect((await stat(path.join(root, relativePath))).isDirectory()).toBe(
        true
      );
    })
  );
}

async function expectEmptyFiles(
  root: string,
  relativePaths: readonly string[]
): Promise<void> {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      expect((await stat(path.join(root, relativePath))).isFile()).toBe(true);
      expect(await readFile(path.join(root, relativePath), 'utf8')).toBe('');
    })
  );
}

function isDirectoryPath(relativePath: string): boolean {
  return !relativePath.endsWith('/.gitkeep');
}

async function filePaths(root: string): Promise<readonly string[]> {
  const entries = await walk(root, root);
  return sortedPaths(entries.map((entry) => entry.path));
}

function sortedPaths(paths: readonly string[]): string[] {
  const sorted: string[] = [];
  for (const candidatePath of paths) {
    const index = sorted.findIndex(
      (existingPath) => existingPath.localeCompare(candidatePath) > 0
    );
    if (index < 0) {
      sorted.push(candidatePath);
    } else {
      sorted.splice(index, 0, candidatePath);
    }
  }
  return sorted;
}

async function walk(
  root: string,
  directory: string
): Promise<readonly FileEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path
        .relative(root, absolutePath)
        .split(path.sep)
        .join('/');
      if (!entry.isDirectory()) {
        return entry.isFile()
          ? [{ kind: 'file' as const, path: relativePath }]
          : [];
      }
      return walk(root, absolutePath);
    })
  );
  return nested.flat();
}

type FileEntry = Readonly<{
  readonly kind: 'file';
  readonly path: string;
}>;

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
