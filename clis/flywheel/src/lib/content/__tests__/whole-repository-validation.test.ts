import { afterEach, expect, test } from 'bun:test';

import { createFlywheelDeps } from '../../runtime/deps.js';
import type { ProspectiveFileChange } from '../repository-state.js';
import { createRepositoryState } from '../repository-state.js';
import {
  cleanupTemporaryDirectories,
  makeGitRepository,
  makeRepository,
  runGit,
  runGitProcess,
  validCatalog,
  validDaemon,
  validDocument,
  validRole,
  validSkill,
  validate,
  writeRepositoryFile,
} from './whole-repository-validation-test-helpers.js';

afterEach(cleanupTemporaryDirectories);

test('validates the working tree, including untracked content', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/guide.md',
    'not valid markdown\n'
  );
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/untracked.md',
    'not valid markdown\n'
  );

  const result = await validate(repositoryPath);

  expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
    'customer-wide/docs/guide.md',
    'customer-wide/docs/untracked.md',
  ]);
});

test('validates the exact index and excludes unstaged and untracked files', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/guide.md',
    'not valid markdown\n'
  );
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/untracked.md',
    'not valid markdown\n'
  );

  const cleanIndex = await validate(repositoryPath, { kind: 'index' });
  expect(cleanIndex.diagnostics).toEqual([]);

  await runGit(repositoryPath, ['add', 'customer-wide/docs/guide.md']);
  const changedIndex = await validate(repositoryPath, { kind: 'index' });
  expect(changedIndex.diagnostics.map((diagnostic) => diagnostic.path)).toEqual(
    ['customer-wide/docs/guide.md']
  );
});

test('reports unmerged index entries as staged metadata errors', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  await runGit(repositoryPath, ['checkout', '-qb', 'conflict-side']);
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/guide.md',
    validDocument.replace('A useful guide', 'The side guide')
  );
  await runGit(repositoryPath, ['add', '-A']);
  await runGit(repositoryPath, ['commit', '-qm', 'side change']);
  await runGit(repositoryPath, ['checkout', '-q', '-']);
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/guide.md',
    validDocument.replace('A useful guide', 'The main guide')
  );
  await runGit(repositoryPath, ['add', '-A']);
  await runGit(repositoryPath, ['commit', '-qm', 'main change']);
  expect(
    (await runGitProcess(repositoryPath, ['merge', 'conflict-side'])).exitCode
  ).not.toBe(0);

  const result = await validate(repositoryPath, { kind: 'index' });

  expect(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === 'customer-wide/docs/guide.md' &&
        diagnostic.ruleId === 'FW-STAGED-001'
    )
  ).toBe(true);
});

test('reads one explicit committed tree without using working-tree bytes', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  await writeRepositoryFile(
    repositoryPath,
    'customer-wide/docs/guide.md',
    'not valid markdown\n'
  );

  const result = await validate(repositoryPath, {
    kind: 'commit',
    ref: 'HEAD',
  });

  expect(result.diagnostics).toEqual([]);
});

test('validates a prospective command result without writing it', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const base = createRepositoryState({
    filesystem: createFlywheelDeps().filesystem,
    process: createFlywheelDeps().process,
    repositoryPath,
  });
  const changes: readonly ProspectiveFileChange[] = [
    {
      content: 'not valid markdown\n',
      path: 'customer-wide/docs/guide.md',
    },
  ];
  const result = await validate(repositoryPath, {
    base,
    changes,
    kind: 'prospective',
  });

  expect(result.diagnostics).toMatchObject([
    { path: 'customer-wide/docs/guide.md', ruleId: 'FW-DOC-001' },
  ]);
});

test('preserves the base file for prospective mode-only changes', async () => {
  const repositoryPath = await makeGitRepository({
    'customer-wide/docs/guide.md': validDocument,
  });
  const base = createRepositoryState({
    filesystem: createFlywheelDeps().filesystem,
    process: createFlywheelDeps().process,
    repositoryPath,
  });

  const result = await validate(repositoryPath, {
    base,
    changes: [{ mode: 0o100755, path: 'customer-wide/docs/guide.md' }],
    kind: 'prospective',
  });

  expect(result.diagnostics).toEqual([]);
});

test('joins Roles, Daemons, Catalog, Docs, and Skills into one graph', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/.agents/daemons/reviewer/DAEMON.md': validDaemon,
    'customer-wide/.agents/skills/reviewer/SKILL.md': validSkill,
    'customer-wide/catalog/billing.yaml': validCatalog,
    'customer-wide/docs/billing.md': validDocument.replace(
      'reviewEvery: 90d',
      'reviewEvery: 90d\nabout: [component:default/billing]'
    ),
    'roles/reviewer.yaml': validRole,
  });

  const result = await validate(repositoryPath);

  expect(result.diagnostics).toEqual([]);
});

test('reports Role membership and review-record errors while continuing independently', async () => {
  const repositoryPath = await makeRepository({
    '.flywheel/reviews.yaml': [
      'schemaVersion: 1',
      'reviews:',
      '  - target: role:missing',
      '    reviewedAt: invalid',
      '    contentHash: sha256:bad',
      '    rootTaskId: ""',
      '',
    ].join('\n'),
    'roles/orphan.yaml': validRole.replace('id: reviewer', 'id: orphan'),
    'customer-wide/docs/bad.md': 'not valid markdown\n',
  });

  const result = await validate(repositoryPath);
  const ruleIds = result.diagnostics.map((diagnostic) => diagnostic.ruleId);

  expect(ruleIds).toContain('FW-ROLE-003');
  expect(ruleIds).toContain('FW-REVIEW-002');
  expect(ruleIds).toContain('FW-DOC-001');
});

test('focused validation includes relationship diagnostics but excludes unrelated files', async () => {
  const repositoryPath = await makeRepository({
    'customer-wide/docs/selected.md': validDocument.replace(
      'reviewEvery: 90d',
      'reviewEvery: 90d\nabout: [component:default/missing]'
    ),
    'customer-wide/docs/unrelated.md': 'not valid markdown\n',
  });

  const result = await validate(repositoryPath, undefined, [
    'customer-wide/docs/selected.md',
  ]);

  expect(result.diagnostics).toMatchObject([
    { path: 'customer-wide/docs/selected.md', ruleId: 'FW-REF-002' },
  ]);
  expect(
    result.diagnostics.some((diagnostic) =>
      diagnostic.path.endsWith('unrelated.md')
    )
  ).toBe(false);
});

test('validates review hashes and ignores links inside fenced code', async () => {
  const repositoryPath = await makeRepository({
    '.flywheel/reviews.yaml': [
      'schemaVersion: 1',
      'reviews:',
      '  - target: role:reviewer',
      '    reviewedAt: 2026-08-28T12:00:00Z',
      '    contentHash: sha256:BAD',
      '    rootTaskId: tsk_review',
      '',
    ].join('\n'),
    'customer-wide/.agents/daemons/reviewer/DAEMON.md': validDaemon,
    'customer-wide/docs/guide.md': [
      validDocument,
      '[^missing]',
      '',
      '```md',
      '[ignored](broken-target.md)',
      '```',
      '',
      '[^unused]: https://example.com/unused',
      '',
    ].join('\n'),
    'roles/reviewer.yaml': validRole,
  });

  const result = await validate(repositoryPath);

  expect(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.field === 'contentHash' &&
        diagnostic.path === '.flywheel/reviews.yaml' &&
        diagnostic.ruleId === 'FW-REVIEW-002'
    )
  ).toBe(true);
  expect(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === 'customer-wide/docs/guide.md' &&
        diagnostic.ruleId === 'FW-REF-003' &&
        diagnostic.severity === 'error'
    )
  ).toBe(true);
  expect(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.path === 'customer-wide/docs/guide.md' &&
        diagnostic.ruleId === 'FW-REF-003' &&
        diagnostic.severity === 'warning'
    )
  ).toBe(true);
  expect(
    result.diagnostics.some(
      (diagnostic) => diagnostic.target === 'broken-target.md'
    )
  ).toBe(false);
});
