import { afterEach, describe, expect, test } from 'bun:test';
import path from 'node:path';

import Rg from '../../../cli/commands/content/rg.js';
import Validate from '../../../cli/commands/content/validate.js';
import { createFlywheelDeps, type ProcessResult } from '../../runtime/deps.js';
import type { ContentDiagnostic } from '../errors.js';
import { runContentRg } from '../rg.js';
import { createContentSelection } from '../roots.js';
import { validateContent } from '../validate.js';
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

describe('content rg forwards safe arguments', () => {
  test('forwards safe arguments and repository-relative roots', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/guide.md': 'incident\n',
      'core/secret.md': 'must not be searched\n',
      'repo-specific/acme/api/docs/guide.md': 'incident\n',
      'roles/analyst.yaml': 'name: analyst\n',
    });
    const calls: Array<{
      readonly args: readonly string[];
      readonly command: string;
      readonly cwd: string | undefined;
    }> = [];
    const result = await runContentRg({
      filesystem: createFlywheelDeps().filesystem,
      process: {
        run: (command, args, options) => {
          calls.push({ args, command, cwd: options?.cwd });
          return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
        },
      },
      rgArgs: ['-g', '*.md', 'incident'],
      selection: selectionFor(repositoryPath),
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([
      {
        args: [
          '-g',
          '*.md',
          'incident',
          'customer-wide/docs',
          'repo-specific/acme/api/docs',
          'roles',
        ],
        command: 'rg',
        cwd: repositoryPath,
      },
    ]);
  });
});

describe('content rg preserves admitted paths', () => {
  test('preserves an admitted repository-relative path operand', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/guide.md': 'incident\n',
    });
    const calls: string[][] = [];

    await runContentRg({
      filesystem: createFlywheelDeps().filesystem,
      process: {
        run: (
          _command: string,
          args: readonly string[]
        ): Promise<ProcessResult> => {
          calls.push([...args]);
          return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
        },
      },
      rgArgs: ['incident', 'customer-wide/docs'],
      selection: selectionFor(repositoryPath),
    });

    expect(calls).toEqual([['incident', 'customer-wide/docs']]);
  });
});

describe('content rg rejects path escapes', () => {
  test('rejects path escapes before starting ripgrep', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/guide.md': 'incident\n',
    });
    let started = false;

    await expectExitCode(
      runContentRg({
        filesystem: createFlywheelDeps().filesystem,
        process: {
          run: () => {
            started = true;
            return Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
          },
        },
        rgArgs: ['incident', '../outside'],
        selection: selectionFor(repositoryPath),
      }),
      2
    );
    expect(started).toBe(false);
  });
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
    const repositoryPath = await makeRepository({
      'customer-wide/.agents/skills/example.md': 'not validated\n',
      'customer-wide/docs/bad.md': '---\n---\n# Bad\n',
      'customer-wide/docs/good.md': validDocument,
      'customer-wide/unknown.txt': 'unsupported\n',
    });
    const before = await readRepositoryFiles(repositoryPath);
    const first = await validateContent({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });
    const second = await validateContent({
      filesystem: createFlywheelDeps().filesystem,
      paths: [],
      repositoryPath,
    });
    const after = await readRepositoryFiles(repositoryPath);

    expect(first).toEqual(second);
    expect(first.filesChecked).toBe(4);
    expect(diagnosticKeys(first.diagnostics)).toEqual([
      'customer-wide/docs/bad.md:FW-DOC-003',
      'customer-wide/docs/bad.md:FW-DOC-003',
      'customer-wide/docs/bad.md:FW-DOC-005',
      'customer-wide/unknown.txt:FW-PATH-002',
    ]);
    expect(after).toEqual(before);
  });
});

describe('content validate rejects path escapes', () => {
  test('rejects validation paths outside the admitted repository slice', async () => {
    const repositoryPath = await makeRepository({
      'customer-wide/docs/good.md': validDocument,
    });

    await expectExitCode(
      validateContent({
        filesystem: createFlywheelDeps().filesystem,
        paths: ['../outside'],
        repositoryPath,
      }),
      2
    );
  });
});

describe('content validate command metadata', () => {
  test('registers the generated repository-path flag', () => {
    expect(Validate.summary).toBe(
      'Validate the supported Flywheel content slice'
    );
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

function selectionFor(repositoryPath: string) {
  return createContentSelection({
    customerWideOnly: false,
    cwd: repositoryPath,
    repoIds: [],
    repositoryPath,
  });
}

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
  diagnostics: readonly ContentDiagnostic[]
): readonly string[] {
  return diagnostics.map(
    (diagnostic) => `${diagnostic.path}:${diagnostic.ruleId}`
  );
}
