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
import { copyScaffoldDirectories } from '../copy.js';
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

test('scaffolds manifest directories and ignores other source files', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    ['empty-dir', 'nested', 'nested/deep'].join('\n')
  );
  await writeFile(path.join(sourceRoot, 'README.md'), 'do not install');

  const result = await copyScaffoldDirectories({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['empty-dir', 'nested', 'nested/deep'],
    skipped: [],
  });
  expect(await exists(path.join(destinationRoot, 'README.md'))).toBe(false);
});

test('does not read source content files', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(path.join(sourceRoot, 'DIRECTORIES'), 'directory\n');
  await writeFile(path.join(sourceRoot, 'content.md'), 'do not install');
  const baseFilesystem = createFlywheelDeps().filesystem;

  const result = await copyScaffoldDirectories({
    destinationRoot,
    filesystem: {
      ...baseFilesystem,
      readFileBytes: failIfContentRead,
    },
    sourceRoot,
  });

  expect(result).toEqual({ copied: ['directory'], skipped: [] });
});

test('skips existing directories and preserves their contents', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    ['existing', 'existing/child', 'new'].join('\n')
  );
  await mkdir(path.join(destinationRoot, 'existing'));
  await writeFile(path.join(destinationRoot, 'existing', 'keep.txt'), 'keep');

  const result = await copyScaffoldDirectories({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['existing/child', 'new'],
    skipped: ['existing'],
  });
  expect(
    await readFile(path.join(destinationRoot, 'existing/keep.txt'), 'utf8')
  ).toBe('keep');
});

test('deduplicates repeated manifest destinations in the report', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    ['directory', 'directory', 'directory/child'].join('\n')
  );

  const result = await copyScaffoldDirectories({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['directory', 'directory/child'],
    skipped: [],
  });
});

test('fails on a destination structural mismatch without replacing it', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(path.join(sourceRoot, 'DIRECTORIES'), 'nested\n');
  await writeFile(path.join(destinationRoot, 'nested'), 'keep');

  const error = await captureFailure(() =>
    copyScaffoldDirectories({
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

test('rejects a symbolic-link directory manifest without following it', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  const outsideManifest = path.join(
    await makeDirectory('outside'),
    'DIRECTORIES'
  );
  await writeFile(outsideManifest, 'directory\n');
  await symlink(outsideManifest, path.join(sourceRoot, 'DIRECTORIES'));

  const error = await captureFailure(() =>
    copyScaffoldDirectories({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot,
    })
  );

  expect(error).toBeInstanceOf(ContentSetupError);
  expect(error).toMatchObject({
    path: 'DIRECTORIES',
    reason: 'source directory manifest is not a regular file',
  });
  expect(await exists(path.join(destinationRoot, 'directory'))).toBe(false);
});

test('rejects transformed paths that escape the destination root', async () => {
  const sourceRoot = await makeDirectory('source');
  const destinationRoot = await makeDirectory('destination');
  await writeFile(path.join(sourceRoot, 'DIRECTORIES'), 'directory\n');

  const error = await captureFailure(() =>
    copyScaffoldDirectories({
      destinationRoot,
      filesystem: createFlywheelDeps().filesystem,
      sourceRoot,
      transform: {
        destinationPath: () => '../outside',
        fileBytes: (_sourcePath, bytes) => bytes,
      },
    })
  );

  expect(error).toBeInstanceOf(ContentSetupError);
  expect(error).toMatchObject({ path: 'directory' });
  expect(await exists(path.join(destinationRoot, 'outside'))).toBe(false);
});

test('returns the directory-only customer setup result', async () => {
  const sourceRoot = await makeDirectory('customer-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    ['customer-wide', 'customer-wide/docs', 'roles'].join('\n')
  );
  await writeFile(path.join(sourceRoot, 'README.md'), 'do not install');

  const result = await runCustomerSetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    sourceRoot,
  });

  expect(result).toEqual({
    copied: ['customer-wide', 'customer-wide/docs', 'roles'],
    skipped: [],
    validationPerformed: false,
  });
  expect(await exists(path.join(destinationRoot, 'README.md'))).toBe(false);
});

test('normalizes source-repository paths without reprocessing replacement text', async () => {
  const sourceRoot = await makeDirectory('source-repo-scaffold');
  const destinationRoot = await makeDirectory('customer-repository');
  await writeFile(
    path.join(sourceRoot, 'DIRECTORIES'),
    [
      'repo-specific',
      'repo-specific/__owner__',
      'repo-specific/__owner__/__name__',
      'repo-specific/__owner__/__name__/docs',
    ].join('\n')
  );

  const result = await runSourceRepositorySetup({
    destinationRoot,
    filesystem: createFlywheelDeps().filesystem,
    repositoryId: 'acme__name__/api',
    sourceRoot,
  });

  expect(result).toEqual({
    copied: [
      'repo-specific',
      'repo-specific/acme__name__',
      'repo-specific/acme__name__/api',
      'repo-specific/acme__name__/api/docs',
    ],
    skipped: [],
    validationPerformed: false,
  });
  expect(
    await exists(
      path.join(destinationRoot, 'repo-specific/acme__name__/api/docs')
    )
  ).toBe(true);
  expect(
    await exists(path.join(destinationRoot, 'repo-specific/acmeapi/api'))
  ).toBe(false);
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

function failIfContentRead(_filePath: string): Promise<Uint8Array> {
  throw new Error('content files must not be read');
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
