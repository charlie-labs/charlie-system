import { afterEach, expect, test } from 'bun:test';

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
