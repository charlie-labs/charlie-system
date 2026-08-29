import { afterEach, expect, test } from 'bun:test';
import { lstat, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  packageRoot,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

const checkoutRoot = path.resolve(packageRoot, '../..');
const rootExecutablePath = path.join(checkoutRoot, 'bin/flywheel');
const flywheelEntrypointPath = path.join(
  checkoutRoot,
  'clis/flywheel/bin/run.ts'
);

test('resolves the root Flywheel entrypoint within the checkout', async () => {
  const stats = await lstat(rootExecutablePath);

  expect(stats.isSymbolicLink()).toBe(true);
  expect(await readlink(rootExecutablePath)).toBe(
    '../clis/flywheel/bin/run.ts'
  );
  expect(await realpath(rootExecutablePath)).toBe(flywheelEntrypointPath);
});

test('runs root Flywheel help from another working directory', async () => {
  const otherWorkingDirectory = await makeRepository({});
  const child = Bun.spawn([rootExecutablePath, '--help'], {
    cwd: otherWorkingDirectory,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  expect(await child.exited).toBe(0);
  expect(stderr).toBe('');
  expect(stdout).toContain('$ flywheel [COMMAND]');
});
