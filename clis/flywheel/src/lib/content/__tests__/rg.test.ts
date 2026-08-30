import { afterEach, expect, test } from 'bun:test';

import { createFlywheelDeps, type ProcessResult } from '../../runtime/deps.js';
import { runContentRg } from '../rg.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
} from './content-test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('composes discovery and exact search with Charlie-relative scope', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': 'incident\n',
    'core/secret.md': 'must not be searched\n',
    'repo-specific/acme/api/docs/guide.md': 'incident\n',
    'roles/analyst.yaml': 'name: analyst\n',
  });
  const calls: Array<{
    readonly args: readonly string[];
    readonly command: string;
    readonly cwd: string | undefined;
  }> = [];
  const result = await runContentRg({
    customerWideOnly: false,
    filesystem: createFlywheelDeps().filesystem,
    process: {
      run: (command, args, options) => {
        calls.push({ args, command, cwd: options?.cwd });
        return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
      },
    },
    repositoryIds: [],
    repositoryPath,
    rgArgs: ['-g', '*.md', 'incident'],
  });

  expect(result.exitCode).toBe(0);
  expect(calls).toEqual([
    {
      args: [
        '-g',
        '*.md',
        'incident',
        '--no-config',
        '--no-follow',
        '--glob=!**/AGENTS.md',
        '--glob=!**/.agents/rules/**',
        '--glob=!**/.git/**',
        'roles/analyst.yaml',
        'customer-wide/docs',
        'repo-specific/acme/api/docs',
      ],
      command: 'rg',
      cwd: repositoryPath,
    },
  ]);
});

test('preserves an admitted Flywheel repository-relative path operand', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': 'incident\n',
  });
  const calls: string[][] = [];

  await runContentRg({
    customerWideOnly: false,
    filesystem: createFlywheelDeps().filesystem,
    process: {
      run: (_command, args): Promise<ProcessResult> => {
        calls.push([...args]);
        return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
      },
    },
    repositoryIds: [],
    repositoryPath,
    rgArgs: ['incident', 'customer-wide/docs'],
  });

  expect(calls).toEqual([
    [
      'incident',
      'customer-wide/docs',
      '--no-config',
      '--no-follow',
      '--glob=!**/AGENTS.md',
      '--glob=!**/.agents/rules/**',
      '--glob=!**/.git/**',
    ],
  ]);
});

test('rejects path escapes before starting ripgrep', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': 'incident\n',
  });
  let started = false;
  const error = captureError(
    runContentRg({
      customerWideOnly: false,
      filesystem: createFlywheelDeps().filesystem,
      process: {
        run: () => {
          started = true;
          return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
        },
      },
      repositoryIds: [],
      repositoryPath,
      rgArgs: ['incident', '../outside'],
    })
  );

  expect(await error).toMatchObject({ exitCode: 2 });
  expect(started).toBe(false);
});

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected operation to fail');
}
