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
import { ContentSetupError } from '../../setup-error.js';
import { copyScaffoldTree } from '../copy.js';

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

  expect(result).toEqual({ copied: ['new.txt'], skipped: ['existing.txt'] });
  expect(readPaths).toEqual([newSource]);
});

test('applies destination and byte transforms to copied files', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await mkdir(path.join(sourceRoot, '__owner__', '__name__'), {
    recursive: true,
  });
  await writeFile(
    path.join(sourceRoot, '__owner__', '__name__', 'README.md'),
    'repository: __repository_id__\n'
  );

  const result = await copyScaffoldTree({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
    transform: {
      destinationPath: (sourcePath) =>
        sourcePath
          .replaceAll('__owner__', 'acme')
          .replaceAll('__name__', 'api'),
      fileBytes: (_sourcePath, bytes) =>
        new TextEncoder().encode(
          new TextDecoder()
            .decode(bytes)
            .replaceAll('__repository_id__', 'acme/api')
        ),
    },
  });

  expect(result).toEqual({
    copied: ['acme', 'acme/api', 'acme/api/README.md'],
    skipped: [],
  });
  expect(
    await readFile(path.join(destinationRoot, 'acme/api/README.md'), 'utf8')
  ).toBe('repository: acme/api\n');
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
