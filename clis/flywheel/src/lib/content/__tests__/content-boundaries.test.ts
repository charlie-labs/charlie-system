import { afterEach, expect, test } from 'bun:test';
import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';

import Rg from '../../../cli/commands/content/rg.js';
import { createFlywheelDeps } from '../../runtime/deps.js';
import { runContentRg } from '../rg.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
} from './content-test-utils.js';

const commandConfig = path.resolve(import.meta.dir, '../../../../bin/run.ts');

afterEach(async () => {
  process.exitCode = 0;
  await cleanupTemporaryDirectories();
});

test('treats -f values as patterns before validating path operands', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': 'incident\n',
  });
  let started = false;
  const process = {
    run: () => {
      started = true;
      return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
    },
  };

  await expectRejectedPath(repositoryPath, process, ['-f', 'patterns']);
  await expectRejectedPath(repositoryPath, process, ['-fpatterns']);

  expect(started).toBe(false);
});

test('does not follow symlinked inspection roots', async () => {
  const repositoryPath = await makeRepository({
    'outside/guide.md': 'incident\n',
  });
  const symlinkPath = path.join(repositoryPath, 'customer-wide', 'docs');
  await mkdir(path.dirname(symlinkPath), { recursive: true });
  await symlink(path.join(repositoryPath, 'outside'), symlinkPath, 'dir');
  let started = false;

  Rg.setTestDeps({
    filesystem: createFlywheelDeps().filesystem,
    process: {
      run: () => {
        started = true;
        return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
      },
    },
  });
  let error: unknown;
  try {
    await Rg.run(
      ['--repository-path', repositoryPath, '--', 'incident'],
      commandConfig
    );
  } catch (caught) {
    error = caught;
  } finally {
    Rg.clearTestDeps();
  }

  expect(getCommandExitCode(error)).toBe(1);
  expect(started).toBe(false);
});

async function expectRejectedPath(
  repositoryPath: string,
  process: {
    readonly run: () => Promise<
      Readonly<{
        readonly exitCode: number;
        readonly stderr: string;
        readonly stdout: string;
      }>
    >;
  },
  prefix: readonly string[]
): Promise<void> {
  let error: unknown;
  try {
    await runContentRg({
      customerWideOnly: false,
      filesystem: createFlywheelDeps().filesystem,
      process,
      repositoryIds: [],
      repositoryPath,
      rgArgs: [...prefix, '../outside'],
    });
  } catch (caught) {
    error = caught;
  }
  expect(error).toMatchObject({ exitCode: 2 });
}

function getCommandExitCode(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const directExitCode = error['exitCode'];
  if (typeof directExitCode === 'number') {
    return directExitCode;
  }
  const oclif = error['oclif'];
  if (!isRecord(oclif)) {
    return undefined;
  }
  const oclifExit = oclif['exit'];
  return typeof oclifExit === 'number' ? oclifExit : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
