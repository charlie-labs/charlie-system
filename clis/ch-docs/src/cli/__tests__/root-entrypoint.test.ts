import { expect, test } from 'bun:test';
import { lstat, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';

const checkoutRoot = path.resolve(import.meta.dir, '../../../../../');
const rootExecutablePath = path.join(checkoutRoot, 'bin/ch-docs');
const entrypointPath = path.join(checkoutRoot, 'clis/ch-docs/bin/run.ts');

test('resolves the root ch-docs entrypoint within the checkout', async () => {
  const stats = await lstat(rootExecutablePath);

  expect(stats.isSymbolicLink()).toBe(true);
  expect(await readlink(rootExecutablePath)).toBe('../clis/ch-docs/bin/run.ts');
  expect(await realpath(rootExecutablePath)).toBe(entrypointPath);
});

test('runs from outside the checkout and resolves through PATH', async () => {
  const otherWorkingDirectory = '/tmp';
  const child = Bun.spawn(
    [
      'bash',
      '-lc',
      `PATH=${checkoutRoot}/bin:$PATH; command -v ch-docs; cd ${otherWorkingDirectory}; ch-docs --help`,
    ],
    { cwd: otherWorkingDirectory, stderr: 'pipe', stdout: 'pipe' }
  );
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  expect(await child.exited).toBe(0);
  expect(stderr).toBe('');
  expect(stdout).toContain(rootExecutablePath);
  expect(stdout).toContain('$ ch-docs [COMMAND]');
});
