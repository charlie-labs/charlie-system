import { expect, test } from 'bun:test';
import { lstat, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';

const checkoutRoot = path.resolve(import.meta.dir, '../../../../../');
const rootExecutablePath = path.join(checkoutRoot, 'bin/ch-sentry');
const entrypointPath = path.join(checkoutRoot, 'clis/ch-sentry/bin/run.ts');

test('resolves the root ch-sentry entrypoint within the checkout', async () => {
  const stats = await lstat(rootExecutablePath);

  expect(stats.isSymbolicLink()).toBe(true);
  expect(await readlink(rootExecutablePath)).toBe('../clis/ch-sentry/bin/run.ts');
  expect(await realpath(rootExecutablePath)).toBe(entrypointPath);
});

test('runs help from outside the checkout through PATH without credentials', async () => {
  const child = Bun.spawn(
    [
      'bash',
      '-lc',
      `env -u SENTRY_AUTH_TOKEN -u SENTRY_ORG -u SENTRY_REGION -u SENTRY_API_URL PATH=${checkoutRoot}/bin:$PATH bash -c 'cd /tmp; command -v ch-sentry; ch-sentry --help'`,
    ],
    { cwd: '/tmp', stderr: 'pipe', stdout: 'pipe' }
  );
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  expect(await child.exited).toBe(0);
  expect(stderr).toBe('');
  expect(stdout).toContain(rootExecutablePath);
  expect(stdout).toContain('$ ch-sentry [COMMAND]');
});
