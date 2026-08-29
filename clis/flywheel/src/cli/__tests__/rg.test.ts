import { afterEach, expect, test } from 'bun:test';
import { symlink } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('searches only the exact corpus admitted by repository selection', async () => {
  const repositoryPath = await exactSearchRepository();

  const all = await searchMarker(repositoryPath, []);
  const named = await searchMarker(repositoryPath, ['--repo', 'acme/api']);
  const customerWide = await searchMarker(repositoryPath, [
    '--customer-wide-only',
  ]);

  expect(all.exitCode).toBe(0);
  expect(all.stderr).toBe('');
  expect(outputPaths(all.stdout)).toEqual(
    new Set([
      'customer-wide/.agents/skills/reviewer/SKILL.md',
      'customer-wide/docs/guide.md',
      'repo-specific/acme/api/docs/guide.md',
      'repo-specific/beta/web/docs/guide.md',
      'roles/analyst.yaml',
    ])
  );
  expect(outputPaths(named.stdout)).toEqual(
    new Set([
      'customer-wide/.agents/skills/reviewer/SKILL.md',
      'customer-wide/docs/guide.md',
      'repo-specific/acme/api/docs/guide.md',
      'roles/analyst.yaml',
    ])
  );
  expect(outputPaths(customerWide.stdout)).toEqual(
    new Set([
      'customer-wide/.agents/skills/reviewer/SKILL.md',
      'customer-wide/docs/guide.md',
      'roles/analyst.yaml',
    ])
  );
});

test('treats ripgrep --files positionals as admitted paths', async () => {
  const repositoryPath = await exactSearchRepository();
  const result = await runCli([
    'content',
    'rg',
    '--repository-path',
    repositoryPath,
    '--',
    '--files',
    'repo-specific/acme/api/docs',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(outputPaths(result.stdout)).toEqual(
    new Set(['repo-specific/acme/api/docs/guide.md'])
  );
});

test('rejects an explicit path that traverses a repository symlink', async () => {
  const repositoryPath = await exactSearchRepository();
  const outsidePath = await makeRepository({ 'secret.md': 'scope-marker\n' });
  await symlink(
    path.join(outsidePath, 'secret.md'),
    path.join(repositoryPath, 'customer-wide', 'docs', 'linked.md')
  );

  const result = await runCli([
    'content',
    'rg',
    '--repository-path',
    repositoryPath,
    '--',
    'scope-marker',
    'customer-wide/docs/linked.md',
  ]);

  expect(result.exitCode).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('repository-relative admitted path');
});

async function exactSearchRepository(): Promise<string> {
  return makeRepository({
    '.flywheel/reviews.yaml': 'scope-marker\n',
    'core/.agents/daemons/base/DAEMON.md': 'scope-marker\n',
    'customer-wide/.agents/skills/reviewer/SKILL.md': 'scope-marker\n',
    'customer-wide/.agents/rules/security.md': 'scope-marker\n',
    'customer-wide/docs/.agents/rules/local.md': 'scope-marker\n',
    'customer-wide/docs/AGENTS.md': 'scope-marker\n',
    'customer-wide/docs/guide.md': 'scope-marker\n',
    'customer-wide/unsupported/file.md': 'scope-marker\n',
    'repo-specific/acme/api/docs/guide.md': 'scope-marker\n',
    'repo-specific/beta/web/docs/guide.md': 'scope-marker\n',
    'roles/analyst.yaml': 'scope-marker\n',
    'roles/nested/not-a-role.yaml': 'scope-marker\n',
  });
}

async function searchMarker(
  repositoryPath: string,
  selectionArguments: readonly string[]
) {
  return runCli([
    'content',
    'rg',
    '--repository-path',
    repositoryPath,
    ...selectionArguments,
    '--',
    '--fixed-strings',
    '--files-with-matches',
    'scope-marker',
  ]);
}

function outputPaths(stdout: string): ReadonlySet<string> {
  return new Set(
    stdout
      .trim()
      .split('\n')
      .filter((line) => line !== '')
  );
}
