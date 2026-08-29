import { afterEach, expect, test } from 'bun:test';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('proves invalid invocations and negative results use stable exits', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/guide.md': 'PLACEHOLDER incident\n',
  });
  const cases = invalidInvocationCases(repositoryPath);
  const results = await Promise.all(
    cases.map(async (testCase) => ({
      result: await runCli(testCase.args),
      testCase,
    }))
  );

  for (const { result, testCase } of results) {
    expect(result.exitCode).toBe(testCase.exitCode);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(testCase.stderr);
  }
});

function invalidInvocationCases(repositoryPath: string) {
  return [
    {
      args: [
        'content',
        'rg',
        '--repository-path',
        repositoryPath,
        'PLACEHOLDER',
      ],
      exitCode: 2,
      stderr: 'requires a literal -- delimiter',
    },
    {
      args: [
        'content',
        'rg',
        '--repository-path',
        repositoryPath,
        '--',
        'missing',
      ],
      exitCode: 1,
      stderr: 'no matches',
    },
    {
      args: [
        'content',
        'rg',
        '--repository-path',
        repositoryPath,
        '--',
        'PLACEHOLDER',
        '../outside',
      ],
      exitCode: 2,
      stderr: 'repository-relative admitted path',
    },
    {
      args: [
        'content',
        'rg',
        '--repository-path',
        repositoryPath,
        '--',
        'PLACEHOLDER',
        '--json',
      ],
      exitCode: 2,
      stderr: 'does not support --json',
    },
    {
      args: ['not-a-command'],
      exitCode: 2,
      stderr: 'command not-a-command not found',
    },
  ];
}
