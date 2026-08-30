import { expect, test } from 'bun:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

test('emits one JSON document for successful command output', async () => {
  const result = await runInjectedSuccess();

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual({
    projects: [
      { name: 'My Project', slug: 'my-project', platform: 'javascript' },
    ],
  });
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

async function runInjectedSuccess(): Promise<CliResult> {
  const commandPath = pathToFileURL(
    path.join(packageRoot, 'src/cli/commands/projects/list.ts')
  ).href;
  const script = `
import { Config } from '@oclif/core';
import ProjectsList from ${JSON.stringify(commandPath)};
const config = await Config.load(${JSON.stringify(packageRoot)});
ProjectsList.setTestDeps({
  client: {
    getProjects: async () => [
      { name: 'My Project', slug: 'my-project', platform: 'javascript' },
    ],
  },
});
await ProjectsList.run(['--json'], config);
`;
  return runScript(script);
}

async function runScript(script: string): Promise<CliResult> {
  const child = Bun.spawn(['bun', '-e', script], {
    cwd: packageRoot,
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
