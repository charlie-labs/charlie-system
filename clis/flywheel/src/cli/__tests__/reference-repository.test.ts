import { afterEach, expect, test } from 'bun:test';

import {
  cleanupReferenceRepositories,
  referenceRepository,
} from '../../lib/__tests__/fixtures/reference-repository.js';
import {
  cleanupTemporaryDirectories,
  runCli,
  snapshotTree,
} from './test-utils.js';

afterEach(async () => {
  await cleanupReferenceRepositories();
  await cleanupTemporaryDirectories();
});

test('validates and retrieves the reference repository in both CLI modes', async () => {
  const fixture = await referenceRepository();
  const repositoryPath = fixture.repositoryPath;
  const before = await snapshotTree(repositoryPath);
  const [humanValidation, jsonValidation, humanSearch, jsonSearch] =
    await Promise.all([
      runCli(['content', 'validate', '--repository-path', repositoryPath]),
      runCli([
        'content',
        'validate',
        '--repository-path',
        repositoryPath,
        '--json',
      ]),
      runCli([
        'knowledge',
        'search',
        'release',
        '--repository-path',
        repositoryPath,
      ]),
      runCli([
        'knowledge',
        'search',
        'release',
        '--repository-path',
        repositoryPath,
        '--json',
      ]),
    ]);
  const after = await snapshotTree(repositoryPath);

  expect(humanValidation.exitCode).toBe(0);
  expect(humanValidation.stdout).toBe('');
  expect(humanValidation.stderr).toContain('validated');
  expect(humanValidation.stderr).toContain('FW-REPOSITORY-UNSUPPORTED');

  expect(jsonValidation.exitCode).toBe(0);
  expect(jsonValidation.stderr).toBe('');
  expect(JSON.parse(jsonValidation.stdout)).toMatchObject({
    diagnostics: [{ ruleId: 'FW-REPOSITORY-UNSUPPORTED' }],
    status: 'valid',
  });

  expect(humanSearch.exitCode).toBe(0);
  expect(humanSearch.stderr).toBe('');
  expect(humanSearch.stdout).toContain('Release guide');
  expect(humanSearch.stdout).toContain(
    'Release operations use the platform API.'
  );

  expect(jsonSearch.exitCode).toBe(0);
  expect(jsonSearch.stderr).toBe('');
  expect(JSON.parse(jsonSearch.stdout)).toMatchObject({
    context: { query: 'release' },
    kind: 'results',
  });
  expect(jsonSearch.stdout).toContain('customer-wide/docs/release-guide.md');
  expect(after).toEqual(before);
});

test('returns separated human and JSON failures for malformed fixture content', async () => {
  const fixture = await referenceRepository({ overlay: 'malformed' });
  const repositoryPath = fixture.repositoryPath;
  const before = await snapshotTree(repositoryPath);
  const [human, json] = await Promise.all([
    runCli(['content', 'validate', '--repository-path', repositoryPath]),
    runCli([
      'content',
      'validate',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);
  const after = await snapshotTree(repositoryPath);

  expect(human.exitCode).toBe(1);
  expect(human.stdout).toBe('');
  expect(human.stderr).toContain('FW-ARTIFACT-FRONTMATTER-REQUIRED');

  expect(json.exitCode).toBe(1);
  expect(json.stderr).toBe('');
  const jsonValue: unknown = JSON.parse(json.stdout);
  expect(jsonValue).toMatchObject({
    error: {
      status: 'incomplete',
      type: 'ContentValidationError',
    },
  });
  const diagnostics = diagnosticRuleIdsFromJson(jsonValue);
  expect(diagnostics.includes('FW-ARTIFACT-FRONTMATTER-REQUIRED')).toBe(true);
  expect(after).toEqual(before);
});

test('runs content show and related against the shared fixture in both modes', async () => {
  const fixture = await referenceRepository();
  const repositoryPath = fixture.repositoryPath;
  const [humanShow, jsonShow, humanRelated, jsonRelated] =
    await runReferenceContentCommands(repositoryPath);

  expect(humanShow.exitCode).toBe(0);
  expect(humanShow.stderr).toBe('');
  expect(humanShow.stdout).toContain(
    'target document:customer-wide%2Fdocs%2Frelease-guide.md'
  );
  expect(humanShow.stdout).toContain(
    'Release operations use the platform API.'
  );

  expect(jsonShow.exitCode).toBe(0);
  expect(jsonShow.stderr).toBe('');
  expect(JSON.parse(jsonShow.stdout)).toMatchObject({
    kind: 'artifact',
    targetId: 'document:customer-wide%2Fdocs%2Frelease-guide.md',
  });

  expect(humanRelated.exitCode).toBe(0);
  expect(humanRelated.stderr).toBe('');
  expect(humanRelated.stdout).toContain(
    'outgoing about catalog:component%3Adefault%2Fapi'
  );
  expect(humanRelated.stdout).toContain(
    'incoming links-to skill:customer-wide%2F.agents%2Fskills%2Frelease-operator%2FSKILL.md'
  );

  expect(jsonRelated.exitCode).toBe(0);
  expect(jsonRelated.stderr).toBe('');
  expect(JSON.parse(jsonRelated.stdout)).toMatchObject({
    kind: 'related',
    target: { id: 'document:customer-wide%2Fdocs%2Frelease-guide.md' },
  });
});

function runReferenceContentCommands(repositoryPath: string) {
  return Promise.all([
    runCli([
      'content',
      'show',
      'customer-wide/docs/release-guide.md',
      '--repository-path',
      repositoryPath,
    ]),
    runCli([
      'content',
      'show',
      'customer-wide/docs/release-guide.md',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'content',
      'related',
      'customer-wide/docs/release-guide.md',
      '--repository-path',
      repositoryPath,
    ]),
    runCli([
      'content',
      'related',
      'customer-wide/docs/release-guide.md',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);
}

function diagnosticRuleIdsFromJson(value: unknown): readonly string[] {
  if (!isRecord(value) || !isRecord(value.error)) {
    throw new Error('CLI error JSON did not include an error object');
  }
  if (!Array.isArray(value.error.diagnostics)) {
    throw new TypeError('CLI error JSON did not include diagnostics');
  }
  const ruleIds: string[] = [];
  for (const diagnostic of value.error.diagnostics) {
    if (!isRecord(diagnostic) || typeof diagnostic.ruleId !== 'string') {
      throw new Error('CLI diagnostic did not include a rule ID');
    }
    ruleIds.push(diagnostic.ruleId);
  }
  return ruleIds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
