import { afterEach, expect, test } from 'bun:test';

import Search from '../commands/knowledge/search.js';
import {
  cleanupTemporaryDirectories,
  makeRepository,
  runCli,
} from './test-utils.js';

afterEach(cleanupTemporaryDirectories);

test('registers knowledge search as artifact-grouped ranked retrieval', () => {
  expect(Search.summary).toBe(
    'Find Knowledge relevant to a question or keywords'
  );
});

test('renders source-faithful results and a score-free JSON boundary', async () => {
  const repositoryPath = await makeSearchRepository();
  const [human, json] = await Promise.all([
    runCli([
      'knowledge',
      'search',
      'production',
      '--repository-path',
      repositoryPath,
      '--limit',
      '1',
    ]),
    runCli([
      'knowledge',
      'search',
      'deployment',
      '--repo',
      'acme/api',
      '--content-type',
      'document',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);

  expect(human.exitCode).toBe(0);
  expect(human.stderr).toBe('');
  expect(human.stdout).toContain(
    'Flywheel repos: customer-wide and all Flywheel repos'
  );
  expect(human.stdout).toContain(
    'Production deployments require approval.[^proof]'
  );
  expect(human.stdout).toContain('[^proof]: Approval evidence.');
  expect(human.stdout).toContain('[… omitted …]');
  expect(human.stdout).not.toContain('score:');

  expect(json.exitCode).toBe(0);
  expect(json.stderr).toBe('');
  const jsonValue: unknown = JSON.parse(json.stdout);
  expect(jsonValue).toMatchObject({
    context: {
      contentTypes: ['document'],
      repositorySelection: {
        kind: 'customer-wide-and-repositories',
        repositories: ['acme/api'],
      },
    },
    kind: 'results',
  });
  expect(json.stdout).toContain('repo-specific/acme/api/docs/deployment.md');
  expect(json.stdout).not.toContain(
    'repo-specific/acme/web/docs/deployment.md'
  );
  expect(json.stdout).not.toContain('"score"');
});

test('uses the parsed query when flags precede it', async () => {
  const repositoryPath = await makeSearchRepository();
  const result = await runCli([
    'knowledge',
    'search',
    '--repository-path',
    repositoryPath,
    '--repo',
    'acme/api',
    '--json',
    'deployment',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    context: {
      query: 'deployment',
      repositorySelection: {
        kind: 'customer-wide-and-repositories',
        repositories: ['acme/api'],
      },
    },
    kind: 'results',
  });
  expect(result.stdout).not.toContain(
    'repo-specific/acme/web/docs/deployment.md'
  );
});

test('preserves human and JSON failures when flags precede the query', async () => {
  const repositoryPath = await makeSearchRepository();
  const missingPath = `${repositoryPath}/missing`;
  const [humanFailure, jsonFailure] = await Promise.all([
    runCli(['knowledge', 'search', '--repository-path', missingPath, '   ']),
    runCli([
      'knowledge',
      'search',
      '--repository-path',
      missingPath,
      '--json',
      '   ',
    ]),
  ]);

  expect(humanFailure.exitCode).toBe(2);
  expect(humanFailure.stdout).toBe('');
  expect(humanFailure.stderr).toContain('search query must not be empty');
  expect(humanFailure.stderr).not.toContain('repository');

  expect(jsonFailure.exitCode).toBe(2);
  expect(jsonFailure.stderr).toBe('');
  expect(JSON.parse(jsonFailure.stdout)).toMatchObject({
    error: {
      outcome: {
        kind: 'invalid-selection',
        message: 'search query must not be empty',
      },
      type: 'KnowledgeSearchError',
    },
  });
});

test('keeps empty retrieval outcomes successful and lifecycle expansion explicit', async () => {
  const repositoryPath = await makeSearchRepository();
  const [noEligible, noUseful, activeOnly, expanded] = await Promise.all([
    runCli([
      'knowledge',
      'search',
      'deployment',
      '--content-type',
      'catalog',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'knowledge',
      'search',
      'quantum-zebra',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'knowledge',
      'search',
      'retired-handbook',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
    runCli([
      'knowledge',
      'search',
      'retired-handbook',
      '--include-non-active',
      '--repository-path',
      repositoryPath,
      '--json',
    ]),
  ]);

  expect(noEligible.exitCode).toBe(0);
  expect(JSON.parse(noEligible.stdout)).toMatchObject({
    kind: 'no-eligible-content',
  });
  expect(noUseful.exitCode).toBe(0);
  expect(JSON.parse(noUseful.stdout)).toMatchObject({
    kind: 'no-useful-result',
  });
  expect(activeOnly.exitCode).toBe(0);
  expect(JSON.parse(activeOnly.stdout)).toMatchObject({
    kind: 'no-useful-result',
    notices: [{ kind: 'inactive-content-excluded' }],
  });
  expect(expanded.exitCode).toBe(0);
  expect(JSON.parse(expanded.stdout)).toMatchObject({
    context: { lifecycleSelection: { kind: 'include-non-active' } },
    kind: 'results',
  });
});

test('returns explicit failures for invalid, incomplete, missing, and unknown repositories', async () => {
  const invalidPath = await makeRepository({
    'customer-wide/AGENTS.md': 'Rules are prohibited here.\n',
    'customer-wide/docs/guide.md': document('Guide', 'Searchable content.'),
  });
  const incompletePath = await makeRepository({
    'customer-wide/docs/broken.md': '# Missing metadata\n',
  });
  const validPath = await makeSearchRepository();
  const missingPath = `${validPath}/missing`;
  const [invalid, incomplete, missing, unknown] = await Promise.all([
    searchFailure(invalidPath),
    searchFailure(incompletePath),
    searchFailure(missingPath),
    runCli([
      'knowledge',
      'search',
      'deployment',
      '--repo',
      'acme/missing',
      '--repository-path',
      validPath,
      '--json',
    ]),
  ]);

  expect(invalid.exitCode).toBe(1);
  expect(JSON.parse(invalid.stdout)).toMatchObject({
    error: {
      outcome: { kind: 'unavailable', reason: 'repository-invalid' },
      type: 'KnowledgeSearchError',
    },
  });
  expect(incomplete.exitCode).toBe(2);
  expect(JSON.parse(incomplete.stdout)).toMatchObject({
    error: { outcome: { reason: 'projection-incomplete' } },
  });
  expect(missing.exitCode).toBe(2);
  expect(JSON.parse(missing.stdout)).toMatchObject({
    error: { outcome: { reason: 'repository-unavailable' } },
  });
  expect(unknown.exitCode).toBe(2);
  expect(JSON.parse(unknown.stdout)).toMatchObject({
    error: { outcome: { kind: 'invalid-selection' } },
  });
});

function searchFailure(repositoryPath: string) {
  return runCli([
    'knowledge',
    'search',
    'deployment',
    '--repository-path',
    repositoryPath,
    '--json',
  ]);
}

async function makeSearchRepository(): Promise<string> {
  return makeRepository({
    'customer-wide/docs/deployment.md': document(
      'Customer deployment',
      'Overview.\n\nProduction deployments require approval.[^proof]\n\nFollow the release procedure.\n\n[^proof]: Approval evidence.'
    ),
    'repo-specific/acme/api/docs/deployment.md': document(
      'API deployment',
      'Deploy the API service.'
    ),
    'repo-specific/acme/api/docs/retired.md': document(
      'Retired handbook',
      'The retired-handbook process is retained for investigation.',
      'deprecated'
    ),
    'repo-specific/acme/web/docs/deployment.md': document(
      'Web deployment',
      'Deploy the Web service.'
    ),
  });
}

function document(title: string, body: string, status = 'active'): string {
  return `---
purpose: Explain ${title.toLowerCase()}.
reviewEvery: 90d
${status === 'active' ? '' : `status: ${status}\n`}---
# ${title}

${body}
`;
}
