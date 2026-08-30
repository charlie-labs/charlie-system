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

test('reports unavailable customer scaffolds as one JSON error value', async () => {
  const repositoryPath = await makeRepository({});
  const result = await runCli([
    'content',
    'setup',
    'customer',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);

  expect(result.exitCode).toBe(2);
  expect(result.stderr).toBe('');
  const output: unknown = JSON.parse(result.stdout);
  expect(output).toMatchObject({
    error: {
      copied: [],
      exitCode: 2,
      skipped: [],
      type: 'ContentSetupError',
    },
  });
  expect(isSetupErrorOutput(output)).toBe(true);
  if (isSetupErrorOutput(output)) {
    expect(output.error.reason).toContain('source entry cannot be inspected');
  }
});

test('keeps setup diagnostics on stderr in human mode', async () => {
  const repositoryPath = await makeRepository({});
  const result = await runCli([
    'content',
    'setup',
    'customer',
    '--repository-path',
    repositoryPath,
  ]);

  expect(result.exitCode).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('content setup cannot copy');
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
    copied: ['__repository_id__.md', 'acme', 'acme/api', 'acme/api/README.md'],
    skipped: [],
    validationPerformed: false,
  });
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

type SetupErrorOutput = Readonly<{
  readonly error: Readonly<{ readonly reason: string }>;
}>;

function isSetupErrorOutput(value: unknown): value is SetupErrorOutput {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return typeof value.error.reason === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
