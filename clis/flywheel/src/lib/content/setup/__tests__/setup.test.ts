import { afterEach, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { createFlywheelDeps } from '../../../runtime/deps.js';
import { ContentInvocationError } from '../../errors.js';
import { ContentSetupError } from '../../setup-error.js';
import { copyScaffoldTree } from '../copy.js';
import { runCustomerSetup } from '../customer.js';
import { runSourceRepositorySetup } from '../source-repo.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

test('copies absent entries, skips existing entries, and reports sorted paths', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await mkdir(path.join(sourceRoot, 'empty-dir'));
  await writeFile(path.join(sourceRoot, 'alpha.txt'), 'source alpha');
  await mkdir(path.join(sourceRoot, 'nested'));
  await writeFile(path.join(sourceRoot, 'nested', 'beta.txt'), 'source beta');
  await writeFile(path.join(destinationRoot, 'alpha.txt'), 'keep alpha');
  await mkdir(path.join(destinationRoot, 'nested'));

  const result = await copyScaffoldTree({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['empty-dir', 'nested/beta.txt'],
    skipped: ['alpha.txt', 'nested'],
  });
  expect(await readFile(path.join(destinationRoot, 'alpha.txt'), 'utf8')).toBe(
    'keep alpha'
  );
  expect(
    await readFile(path.join(destinationRoot, 'nested', 'beta.txt'), 'utf8')
  ).toBe('source beta');
});

test('does not read source bytes for an existing destination file', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  const existingSource = path.join(sourceRoot, 'existing.txt');
  const newSource = path.join(sourceRoot, 'new.txt');
  await writeFile(existingSource, 'source value');
  await writeFile(newSource, 'new value');
  await writeFile(path.join(destinationRoot, 'existing.txt'), 'keep value');
  const baseFilesystem = createFlywheelDeps().filesystem;
  const readPaths: string[] = [];

  const result = await copyScaffoldTree({
    destinationRoot,
    filesystem: {
      ...baseFilesystem,
      readFileBytes: async (filePath) => {
        readPaths.push(filePath);
        return baseFilesystem.readFileBytes(filePath);
      },
    },
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['new.txt'],
    skipped: ['existing.txt'],
  });
  expect(readPaths).toEqual([newSource]);
});

test('fails on a destination structural mismatch without replacing it', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await mkdir(path.join(sourceRoot, 'nested'));
  await writeFile(path.join(sourceRoot, 'nested', 'file.txt'), 'source');
  await writeFile(path.join(destinationRoot, 'nested'), 'keep');

  const error = await captureFailure(() =>
    copyScaffoldTree({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot,
    })
  );

  expect(error).toBeInstanceOf(ContentSetupError);
  expect(error).toMatchObject({
    path: 'nested',
    reason: 'destination is a file but a directory is required',
    result: { copied: [], skipped: [] },
  });
  expect(await readFile(path.join(destinationRoot, 'nested'), 'utf8')).toBe(
    'keep'
  );
});

test('rejects source and destination symbolic links without following them', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(path.join(sourceRoot, 'target.txt'), 'target');
  await symlink(
    path.join(sourceRoot, 'target.txt'),
    path.join(sourceRoot, 'link.txt')
  );

  const sourceError = await captureFailure(() =>
    copyScaffoldTree({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot,
    })
  );
  expect(sourceError).toMatchObject({
    path: 'link.txt',
    reason: 'source entry is not a regular file or directory',
  });

  const cleanSourceRoot = await makeDirectory('clean-source');
  await writeFile(path.join(cleanSourceRoot, 'file.txt'), 'source');
  const outsidePath = path.join(await makeDirectory('outside'), 'file.txt');
  await writeFile(outsidePath, 'outside');
  await symlink(outsidePath, path.join(destinationRoot, 'file.txt'));

  const destinationError = await captureFailure(() =>
    copyScaffoldTree({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot: cleanSourceRoot,
    })
  );
  expect(destinationError).toMatchObject({
    path: 'file.txt',
    reason: 'destination is a symbolic link',
  });
  expect(await readFile(outsidePath, 'utf8')).toBe('outside');
});

test('rejects transformed paths that escape the destination root', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(path.join(sourceRoot, 'file.txt'), 'source');

  const error = await captureFailure(() =>
    copyScaffoldTree({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot,
      transform: {
        destinationPath: () => '../outside.txt',
        fileBytes: (_sourcePath, bytes) => bytes,
      },
    })
  );

  expect(error).toBeInstanceOf(ContentSetupError);
  expect(error).toMatchObject({ path: 'file.txt' });
  expect(await exists(path.join(destinationRoot, 'outside.txt'))).toBe(false);
});

test('returns the copy-only customer setup result', async () => {
  const sourceRoot = await makeDirectory('customer-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  await writeFile(path.join(sourceRoot, 'README.md'), 'authoritative scaffold');

  const result = await runCustomerSetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['README.md'],
    skipped: [],
    validationPerformed: false,
  });
});

test('normalizes a source-repository identity and substitutes only scaffold tokens', async () => {
  const sourceRoot = await makeDirectory('source-repo-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  const templateDirectory = path.join(sourceRoot, '__owner__', '__name__');
  await mkdir(templateDirectory, { recursive: true });
  await writeFile(
    path.join(templateDirectory, 'README.md'),
    'repository: __repository_id__\nowner: __owner__\nname: __name__\n'
  );

  const result = await runSourceRepositorySetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    repositoryId: ' acme/api ',
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['acme', 'acme/api', 'acme/api/README.md'],
    skipped: [],
    validationPerformed: false,
  });
  expect(
    await readFile(path.join(destinationRoot, 'acme/api/README.md'), 'utf8')
  ).toBe('repository: acme/api\nowner: acme\nname: api\n');
});

test('rejects an invalid source-repository identity before filesystem work', async () => {
  let inspected = false;
  const error = await captureFailure(() =>
    runSourceRepositorySetup({
      destinationRoot: '/tmp/destination',
      filesystem: {
        ...createFlywheelDeps().filesystem,
        lstat: () => {
          inspected = true;
          throw new Error('filesystem should not be inspected');
        },
      },
      repositoryId: 'acme/not valid',
      sourceRoot: '/tmp/scaffold',
    })
  );

  expect(error).toBeInstanceOf(ContentInvocationError);
  expect(inspected).toBe(false);
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
