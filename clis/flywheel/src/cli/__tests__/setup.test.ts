import { afterEach, expect, test } from 'bun:test';

import { Config } from '@oclif/core';

import { createFlywheelDeps } from '../../lib/runtime/deps.js';
import Customer from '../commands/content/setup/customer.js';
import SourceRepo from '../commands/content/setup/source-repo.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('registers both setup command contracts', () => {
  expect(Customer.summary).toBe('Install the fixed customer scaffold');
  expect(SourceRepo.summary).toBe('Install a source-repository scaffold');
  expect(SourceRepo.args).toHaveProperty('repository');
});

test('copies the production customer scaffold as one JSON result', async () => {
  const repositoryPath = await makeRepository({});
  const result = await runCli([
    'content',
    'setup',
    'customer',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toEqual({
    copied: [
      'customer-wide',
      'customer-wide/.agents',
      'customer-wide/.agents/daemons',
      'customer-wide/.agents/daemons/pr-review',
      'customer-wide/.agents/daemons/pr-review/DAEMON.md',
      'roles',
      'roles/pr-autopilot.yaml',
    ],
    skipped: [],
    validationPerformed: false,
  });
});

test('keeps production setup diagnostics on stderr in human mode', async () => {
  const repositoryPath = await makeRepository({});
  const result = await runCli([
    'content',
    'setup',
    'customer',
    '--repository-path',
    repositoryPath,
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe(
    [
      'copied:',
      '- customer-wide',
      '- customer-wide/.agents',
      '- customer-wide/.agents/daemons',
      '- customer-wide/.agents/daemons/pr-review',
      '- customer-wide/.agents/daemons/pr-review/DAEMON.md',
      '- roles',
      '- roles/pr-autopilot.yaml',
      'skipped: none',
      'validation: not performed; run content validate before treating the repository as valid or durable',
      '',
    ].join('\n')
  );
});

test('rejects an invalid source-repository identity without scaffold access', async () => {
  const result = await runCli([
    'content',
    'setup',
    'source-repo',
    'acme/not valid',
    '--json',
  ]);

  expect(result.exitCode).toBe(2);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    error: {
      message:
        'invalid repository selection, expected owner/name: acme/not valid',
      type: 'ContentInvocationError',
    },
  });
});

test('renders a successful customer setup only on stderr in human mode', async () => {
  const sourceRoot = await makeRepository({
    'existing.txt': 'source value',
    'nested/new.txt': 'nested value',
    'new.txt': 'new value',
  });
  const repositoryPath = await makeRepository({
    'existing.txt': 'keep value',
    'nested/.keep': 'keep directory',
  });

  const result = await runSetupCommand(
    Customer,
    ['--repository-path', repositoryPath],
    sourceRoot
  );

  expect(result.result).toEqual({
    copied: ['nested/new.txt', 'new.txt'],
    skipped: ['existing.txt', 'nested'],
    validationPerformed: false,
  });
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe(
    [
      'copied:',
      '- nested/new.txt',
      '- new.txt',
      'skipped:',
      '- existing.txt',
      '- nested',
      'validation: not performed; run content validate before treating the repository as valid or durable',
      '',
    ].join('\n')
  );
});

test('returns the successful transformed source-repository result in JSON mode', async () => {
  const sourceRoot = await makeRepository({
    DIRECTORIES: [
      'repo-specific',
      'repo-specific/__owner__',
      'repo-specific/__owner__/__name__',
      'repo-specific/__owner__/__name__/catalog',
      'repo-specific/__owner__/__name__/docs',
      'repo-specific/__owner__/__name__/.agents',
      'repo-specific/__owner__/__name__/.agents/daemons',
      'repo-specific/__owner__/__name__/.agents/skills',
      '',
    ].join('\n'),
    '__owner__/__name__/README.md':
      'repository: __repository_id__\nowner: __owner__\nname: __name__\n',
    '__repository_id__.md': 'repository: __repository_id__\n',
  });
  const repositoryPath = await makeRepository({});

  const result = await runSetupCommand(
    SourceRepo,
    ['acme/api', '--repository-path', repositoryPath, '--json'],
    sourceRoot
  );

  expect(result.result).toEqual({
    copied: [
      '__repository_id__.md',
      'acme',
      'acme/api',
      'acme/api/README.md',
      'repo-specific',
      'repo-specific/acme',
      'repo-specific/acme/api',
      'repo-specific/acme/api/.agents',
      'repo-specific/acme/api/.agents/daemons',
      'repo-specific/acme/api/.agents/skills',
      'repo-specific/acme/api/catalog',
      'repo-specific/acme/api/docs',
    ],
    skipped: [],
    validationPerformed: false,
  });
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

type CapturedSetupResult = Readonly<{
  readonly result: unknown;
  readonly stderr: string;
  readonly stdout: string;
}>;

async function runSetupCommand(
  Command: typeof Customer,
  args: readonly string[],
  scaffoldRoot: string
): Promise<CapturedSetupResult>;
async function runSetupCommand(
  Command: typeof SourceRepo,
  args: readonly string[],
  scaffoldRoot: string
): Promise<CapturedSetupResult>;
async function runSetupCommand(
  Command: typeof Customer | typeof SourceRepo,
  args: readonly string[],
  scaffoldRoot: string
): Promise<CapturedSetupResult> {
  const config = await Config.load();
  Command.setTestDeps({
    filesystem: createFlywheelDeps().filesystem,
    scaffoldRoot,
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: string | Uint8Array) => {
    stdout.push(
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    );
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array) => {
    stderr.push(
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    );
    return true;
  };
  try {
    const result = await new Command([...args], config).run();
    return { result, stderr: stderr.join(''), stdout: stdout.join('') };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}
