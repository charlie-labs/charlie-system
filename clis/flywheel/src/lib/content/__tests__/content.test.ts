import { afterEach, describe, expect, test } from 'bun:test';
import path from 'node:path';

import Rg from '../../../cli/commands/content/rg.js';
import Validate from '../../../cli/commands/content/validate.js';
import { createFlywheelDeps, type ProcessResult } from '../../runtime/deps.js';
import type { ValidationDiagnostic } from '../../validation/contract.js';
import { runContentValidation } from '../validate.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  readRepositoryFiles,
} from './content-test-utils.js';

const commandConfig = path.resolve(import.meta.dir, '../../../../bin/run.ts');
afterEach(async () => {
  process.exitCode = 0;
  await cleanupTemporaryDirectories();
});

describe('content rg maps process statuses', () => {
  test('maps ripgrep no-match and operational statuses', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/guide.md': 'incident\n',
    });
    const noMatchExit = await commandExitCode(
      ['--repository-path', repositoryPath, '--', 'missing'],
      { exitCode: 1, stderr: '', stdout: '' }
    );
    const operationalExit = await commandExitCode(
      ['--repository-path', repositoryPath, '--', 'incident'],
      { exitCode: 2, stderr: '', stdout: '' }
    );

    expect(noMatchExit).toBe(1);
    expect(operationalExit).toBe(2);
  });
});

describe('content rg validates invocation', () => {
  test('requires the delimiter and rejects json on both sides', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/guide.md': 'incident\n',
    });
    const missingDelimiterExit = await commandExitCode(
      ['--repository-path', repositoryPath, 'incident'],
      { exitCode: 0, stderr: '', stdout: '' }
    );
    const jsonBeforeExit = await commandExitCode(
      ['--repository-path', repositoryPath, '--json', '--', 'incident'],
      { exitCode: 0, stderr: '', stdout: '' }
    );
    const jsonAfterExit = await commandExitCode(
      ['--repository-path', repositoryPath, '--', 'incident', '--json'],
      { exitCode: 0, stderr: '', stdout: '' }
    );
    const missingValueExit = await commandExitCode(['--repository-path'], {
      exitCode: 0,
      stderr: '',
      stdout: '',
    });
    const unknownRepositoryExit = await commandExitCode(
      [
        '--repository-path',
        repositoryPath,
        '--repo',
        'acme/missing',
        '--',
        'incident',
      ],
      { exitCode: 0, stderr: '', stdout: '' }
    );

    expect(missingDelimiterExit).toBe(2);
    expect(jsonBeforeExit).toBe(2);
    expect(jsonAfterExit).toBe(2);
    expect(missingValueExit).toBe(2);
    expect(unknownRepositoryExit).toBe(2);
  });
});

describe('content validate is deterministic', () => {
  test('returns deterministic diagnostics without rewriting content', async () => {
    const files = {
      '.flywheel/index.sqlite': 'derived state\n',
      '.flywheel/reviews.yaml': 'reviews: []\n',
      'README.md': 'Repository infrastructure.\n',
      'customer-wide/AGENTS.md': 'Rules are not Flywheel content.\n',
      'customer-wide/docs/bad.md': invalidCadenceDocument,
      'customer-wide/docs/good.md': validDocument,
    };
    const repositoryPath = await makeRepository(files);
    const paths = Object.keys(files);
    const before = await readRepositoryFiles(repositoryPath, paths);
    const first = await runContentValidation({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });
    const second = await runContentValidation({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });
    const after = await readRepositoryFiles(repositoryPath, paths);

    expect(first).toEqual(second);
    expect(first.filesChecked).toBe(4);
    expect(first.status).toBe('invalid');
    expect(diagnosticKeys(first.diagnostics)).toEqual([
      'customer-wide/AGENTS.md:FW-REPOSITORY-RULE-PROHIBITED',
      'customer-wide/docs/bad.md:FW-DOCUMENT-REVIEW-CADENCE',
      'README.md:FW-REPOSITORY-UNSUPPORTED',
    ]);
    expect(after).toEqual(before);
  });

  test('keeps warnings visible without making the assessment fail', async () => {
    const repositoryPath = await makeRepository({
      'README.md': 'Repository infrastructure.\n',
    });

    const result = await runContentValidation({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });

    expect(result).toMatchObject({ filesChecked: 1, status: 'valid' });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        impact: 'none',
        ruleId: 'FW-REPOSITORY-UNSUPPORTED',
        severity: 'warning',
      }),
    ]);
  });
});

describe('content validate path selection', () => {
  test('scopes a full compiled assessment without rereading selected files', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/bad.md': invalidCadenceDocument,
      'customer-wide/docs/good.md': validDocument,
    });

    const result = await runContentValidation({
      filesystem: createFlywheelDeps().filesystem,
      paths: ['customer-wide/docs/good.md'],
      repositoryPath,
    });

    expect(result).toEqual({
      diagnostics: [],
      filesChecked: 1,
      status: 'valid',
    });
  });

  test('selects and counts validation files from inventory classifications', async () => {
    const repositoryPath = await makeRepository({
      '.flywheel/index.sqlite': 'derived state\n',
      '.flywheel/reviews.yaml': 'reviews: []\n',
      'customer-wide/docs/good.md': validDocument,
    });
    const validatePath = (selectedPath: string) =>
      runContentValidation({
        filesystem: createFlywheelDeps().filesystem,
        paths: [selectedPath],
        repositoryPath,
      });

    const repository = await runContentValidation({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });
    expect(repository).toEqual({
      diagnostics: [],
      filesChecked: 1,
      status: 'valid',
    });
    await expectExitCode(validatePath('.flywheel/index.sqlite'), 2);
    await expectExitCode(validatePath('.flywheel'), 2);
  });

  test('rejects escapes, outside paths, and missing paths', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/good.md': validDocument,
    });
    const validatePath = (selectedPath: string) =>
      runContentValidation({
        filesystem: createFlywheelDeps().filesystem,
        paths: [selectedPath],
        repositoryPath,
      });

    await expectExitCode(validatePath('../outside'), 2);
    await expectExitCode(validatePath('README.md'), 2);
    await expectExitCode(validatePath('customer-wide/docs/missing.md'), 2);
  });
});

describe('content validate command metadata', () => {
  test('registers the generated repository-path flag', () => {
    expect(Validate.summary).toBe('Validate the compiled Flywheel repository');
    expect(Validate.flags).toHaveProperty('repository-path');
  });
});

const validDocument = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: 90d',
  '---',
  '# Guide',
  '',
  'This is the guide body.',
  '',
].join('\n');

const invalidCadenceDocument = [
  '---',
  'purpose: A useful guide',
  'reviewEvery: eventually',
  '---',
  '# Guide',
  '',
  'This guide has an invalid review cadence.',
  '',
].join('\n');

async function commandExitCode(
  argv: readonly string[],
  processResult: ProcessResult
): Promise<number> {
  Rg.setTestDeps({
    filesystem: createFlywheelDeps().filesystem,
    process: { run: () => Promise.resolve(processResult) },
  });
  try {
    await Rg.run([...argv], commandConfig);
  } catch (error) {
    const exitCode = getCommandExitCode(error);
    if (exitCode !== undefined) {
      return exitCode;
    }
    throw error;
  } finally {
    Rg.clearTestDeps();
  }
  throw new Error('expected content rg to fail');
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

async function expectExitCode(
  promise: Promise<unknown>,
  exitCode: number
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toMatchObject({ exitCode });
    return;
  }
  throw new Error(`expected failure with exit code ${exitCode}`);
}

function diagnosticKeys(
  diagnostics: readonly ValidationDiagnostic[]
): readonly string[] {
  return diagnostics.map(
    (diagnostic) => `${diagnostic.path}:${diagnostic.ruleId}`
  );
}
