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

const CUSTOMER_DIRECTORIES = [
  '.flywheel',
  '.flywheel/.gitkeep',
  'customer-wide',
  'customer-wide/.agents',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/daemons/pr-review',
  'customer-wide/.agents/daemons/pr-review/.gitkeep',
  'customer-wide/.agents/skills',
  'customer-wide/.agents/skills/.gitkeep',
  'customer-wide/catalog',
  'customer-wide/catalog/.gitkeep',
  'customer-wide/docs',
  'customer-wide/docs/.gitkeep',
  'roles',
  'roles/.gitkeep',
] as const;

const SOURCE_REPOSITORY_DIRECTORIES = [
  '.flywheel',
  'customer-wide',
  'customer-wide/.agents',
  'customer-wide/.agents/daemons',
  'customer-wide/.agents/skills',
  'customer-wide/catalog',
  'customer-wide/docs',
  'repo-specific',
  'repo-specific/acme',
  'repo-specific/acme/api',
  'repo-specific/acme/api/.agents',
  'repo-specific/acme/api/.agents/daemons',
  'repo-specific/acme/api/.agents/skills',
  'repo-specific/acme/api/catalog',
  'repo-specific/acme/api/docs',
] as const;

test('registers both setup command contracts', () => {
  expect(Customer.summary).toBe('Install the fixed customer scaffold');
  expect(SourceRepo.summary).toBe('Install a source-repository scaffold');
  expect(SourceRepo.args).toHaveProperty('repository');
});

test('scaffolds the production customer directories as one JSON result', async () => {
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
    copied: [...CUSTOMER_DIRECTORIES],
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
      ...CUSTOMER_DIRECTORIES.map((directory) => `- ${directory}`),
      'skipped: none',
      'validation: not performed; run content validate before treating the repository as valid or durable',
      'markers: empty scaffold directories include .gitkeep files for later Git tracking',
      'changes: setup changes have not been committed or pushed',
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

test('scaffolds only absent customer directories in human mode', async () => {
  const sourceRoot = await makeRepository({
    DIRECTORIES: ['customer-wide', 'customer-wide/docs', 'roles'].join('\n'),
    'README.md': 'do not install',
  });
  const repositoryPath = await makeRepository({
    'customer-wide/existing.txt': 'keep infrastructure',
  });

  const result = await runSetupCommand(
    Customer,
    ['--repository-path', repositoryPath],
    sourceRoot
  );

  expect(result.result).toEqual({
    copied: ['customer-wide/docs', 'roles'],
    skipped: ['customer-wide'],
    validationPerformed: false,
  });
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe(
    [
      'copied:',
      '- customer-wide/docs',
      '- roles',
      'skipped:',
      '- customer-wide',
      'validation: not performed; run content validate before treating the repository as valid or durable',
      'markers: empty scaffold directories include .gitkeep files for later Git tracking',
      'changes: setup changes have not been committed or pushed',
      '',
    ].join('\n')
  );
});

test('returns only transformed source-repository directories in JSON mode', async () => {
  const sourceRoot = await makeRepository({
    DIRECTORIES: [
      '.flywheel',
      'customer-wide',
      'customer-wide/catalog',
      'customer-wide/docs',
      'customer-wide/.agents',
      'customer-wide/.agents/daemons',
      'customer-wide/.agents/skills',
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
    'README.md': 'do not install',
  });
  const repositoryPath = await makeRepository({});

  const result = await runSetupCommand(
    SourceRepo,
    ['acme/api', '--repository-path', repositoryPath, '--json'],
    sourceRoot
  );

  expect(result.result).toEqual({
    copied: [...SOURCE_REPOSITORY_DIRECTORIES],
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
