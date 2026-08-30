import { expect, test } from 'bun:test';
import path from 'node:path';

const packageRoot = path.resolve(import.meta.dir, '../../..');
const rootExecutable = path.resolve(packageRoot, '../../bin/ch-sentry');

test('discovers every Sentry command and preserves raw version output', async () => {
  const help = await runCli(['--help']);
  expect(help.exitCode).toBe(0);
  expect(help.stderr).toBe('');
  expect(help.stdout).toContain('$ ch-sentry [COMMAND]');
  for (const command of [
    'events',
    'issues',
    'projects',
    'releases',
    'tags',
  ]) {
    expect(help.stdout).toContain(`  ${command}`);
  }

  const [longVersion, shortVersion] = await Promise.all([
    runCli(['--version']),
    runCli(['-v']),
  ]);
  expect(longVersion).toEqual({ exitCode: 0, stderr: '', stdout: '0.1.2\n' });
  expect(shortVersion).toEqual({ exitCode: 0, stderr: '', stdout: '0.1.2\n' });
});

test('keeps missing credentials in the shared JSON error contract', async () => {
  const result = await runCli(['projects', 'list', '--json'], {
    SENTRY_AUTH_TOKEN: undefined,
    SENTRY_ORG: undefined,
    SENTRY_REGION: undefined,
    SENTRY_API_URL: undefined,
  });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    error: { exitCode: 1 },
  });
  expect(result.stdout).not.toContain('test-token');
});

async function runCli(
  args: readonly string[],
  environment: Record<string, string | undefined> = {}
): Promise<CliResult> {
  const env = { ...process.env, ...environment };
  const child = Bun.spawn([rootExecutable, ...args], {
    cwd: '/tmp',
    env,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: await child.exited, stderr, stdout };
}

type CliResult = Readonly<{
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}>;
