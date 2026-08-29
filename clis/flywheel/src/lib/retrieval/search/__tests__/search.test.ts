import { expect, test } from 'bun:test';

import { validationSource } from '../../../validation/__tests__/repository-fixture.js';
import { compileAndAssessRepository } from '../../../validation/assess.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import { createRetrievalScope } from '../../corpus/eligibility.js';
import type { RetrievalCandidateSource } from '../candidate-source.js';
import type { AssessedSearchInput } from '../contract.js';
import { createLexicalCandidateSource } from '../lexical.js';
import { searchAssessedRepository } from '../search.js';

test('returns ranked public results from one assessed repository without more I/O', async () => {
  const { observation, source } = validationSource();
  const repository = await compileAndAssessRepository(source);
  const result = await searchAssessedRepository(
    searchInput(repository, { query: 'release operations safely' })
  );

  expect(result.kind).toBe('results');
  if (result.kind !== 'results') return;
  expect(result.results[0]?.title).toBe('Release guide');
  expect(result.results[0]?.passages[0]?.authoredText).toContain(
    'Operate safely'
  );
  expect(observation).toEqual({
    listCalls: 1,
    readCalls: 1,
    readPaths: [
      [
        'customer-wide/.agents/daemons/release-review/DAEMON.md',
        'customer-wide/catalog/entities.yaml',
        'customer-wide/docs/guide.md',
        'roles/release-manager.yaml',
      ],
    ],
  });
});

test('returns source-faithful Catalog identity and relevant fields', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const result = await searchAssessedRepository(
    searchInput(repository, {
      contentTypes: ['catalog'],
      query: 'repository-api deployment',
    })
  );

  expect(result.kind).toBe('results');
  if (result.kind !== 'results') return;
  const catalogResult = result.results.find(
    (item) =>
      item.contentType === 'catalog' &&
      item.passages.some((passage) =>
        passage.authoredText.includes('name: repository-api')
      )
  );
  expect(catalogResult).toBeDefined();
  expect(catalogResult?.citations).toEqual([]);
  expect(catalogResult?.path).toBe(
    'repo-specific/acme/api/catalog/entities.yaml'
  );
});

test('does not rank a defaulted Catalog namespace as authored text', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const result = await searchAssessedRepository(
    searchInput(repository, {
      contentTypes: ['catalog'],
      query: 'namespace default',
    })
  );

  expect(result.kind).toBe('no-useful-result');
});

test('searches explicitly authored Catalog identity and spec fields', async () => {
  const repository = await compileAndAssessRepository(
    validationSource({
      'customer-wide/catalog/entities.yaml': `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: search-api
  namespace: product
  title: Search API
  annotations:
    charlie.ai/review-every: 90d
spec:
  lifecycle: production
  capability: repository-classification
`,
    }).source
  );
  const result = await searchAssessedRepository(
    searchInput(repository, {
      contentTypes: ['catalog'],
      query: 'product repository-classification',
    })
  );

  expect(result.kind).toBe('results');
  if (result.kind !== 'results') return;
  expect(result.results).toHaveLength(1);
  expect(result.results[0]).toMatchObject({
    artifact: {
      entityKind: 'component',
      kind: 'catalog',
      name: 'search-api',
      namespace: 'product',
    },
    path: 'customer-wide/catalog/entities.yaml',
  });
  expect(
    result.results[0]?.passages.map((passage) => ({
      authoredText: passage.authoredText,
      path: passage.source.path,
      start: passage.source.start,
    }))
  ).toEqual([
    {
      authoredText:
        'kind: Component\nnamespace: product\nname: search-api\ntitle: Search API',
      path: 'customer-wide/catalog/entities.yaml',
      start: { column: 1, line: 1 },
    },
    {
      authoredText: 'lifecycle: production',
      path: 'customer-wide/catalog/entities.yaml',
      start: { column: 1, line: 1 },
    },
    {
      authoredText: 'capability: repository-classification',
      path: 'customer-wide/catalog/entities.yaml',
      start: { column: 1, line: 1 },
    },
  ]);
});

test('fails closed instead of turning invalid or incomplete assessments into empty success', async () => {
  const invalid = await compileAndAssessRepository(
    validationSource({ 'customer-wide/AGENTS.md': 'Rules.\n' }).source
  );
  const incomplete = await compileAndAssessRepository(
    validationSource({ 'customer-wide/docs/broken.md': '# Broken\n' }).source
  );
  const [invalidResult, incompleteResult] = await Promise.all([
    searchAssessedRepository(searchInput(invalid)),
    searchAssessedRepository(searchInput(incomplete)),
  ]);

  expect(invalidResult).toMatchObject({
    kind: 'unavailable',
    reason: 'repository-invalid',
  });
  expect(incompleteResult).toMatchObject({
    kind: 'unavailable',
    reason: 'projection-incomplete',
  });
  if (invalidResult.kind === 'unavailable') {
    expect(invalidResult.diagnostics).not.toHaveLength(0);
  }
  if (incompleteResult.kind === 'unavailable') {
    expect(incompleteResult.diagnostics).not.toHaveLength(0);
  }
});

test('distinguishes no content, no useful result, invalid selection, and backend failures', async () => {
  const documentOnly = await compileAndAssessRepository(
    validationSource({
      'customer-wide/docs/guide.md': `---
purpose: Explain releases.
reviewEvery: 90d
---
# Guide

Release safely.
`,
    }).source
  );
  const noContent = await searchAssessedRepository(
    searchInput(documentOnly, { contentTypes: ['catalog'] })
  );
  const noResult = await searchAssessedRepository(
    searchInput(documentOnly, { query: 'quantum-zebra' })
  );
  const invalidQuery = await searchAssessedRepository(
    searchInput(documentOnly, { query: '   ' })
  );
  const unavailable = await searchAssessedRepository(
    searchInput(documentOnly, { candidateSource: unavailableCandidateSource })
  );
  const unsupported = await searchAssessedRepository(
    searchInput(documentOnly, { candidateSource: unsupportedCandidateSource })
  );

  expect(noContent.kind).toBe('no-eligible-content');
  expect(noResult.kind).toBe('no-useful-result');
  expect(invalidQuery.kind).toBe('invalid-selection');
  expect(unavailable).toMatchObject({
    kind: 'unavailable',
    reason: 'backend-unavailable',
  });
  expect(unsupported).toEqual({
    kind: 'unsupported',
    operation: 'semantic-ranking',
  });
});

test('reports inactive exclusions and rejects unknown repositories', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const result = await searchAssessedRepository(
    searchInput(repository, { query: 'deployment' })
  );
  const unknownRepository = await searchAssessedRepository(
    searchInput(repository, { repositoryIds: ['acme/missing'] })
  );

  expect(result.kind).toBe('results');
  if (result.kind === 'results') {
    expect(result.notices).toContainEqual({
      excludedArtifacts: 1,
      kind: 'inactive-content-excluded',
    });
  }
  expect(unknownRepository).toEqual({
    kind: 'invalid-selection',
    message: 'selected repository does not exist: acme/missing',
  });
});

function searchInput(
  repository: AssessedSearchInput['repository'],
  overrides: Partial<{
    readonly candidateSource: RetrievalCandidateSource;
    readonly contentTypes: readonly ('catalog' | 'document')[];
    readonly query: string;
    readonly repositoryIds: readonly string[];
  }> = {}
): AssessedSearchInput {
  return {
    artifactLimit: 5,
    candidateSource:
      overrides.candidateSource ?? createLexicalCandidateSource(),
    passageLimitPerArtifact: 3,
    query: overrides.query ?? 'release',
    repository,
    scope: createRetrievalScope({
      contentTypes: overrides.contentTypes ?? [],
      customerWideOnly: false,
      includeNonActive: false,
      repositoryIds: overrides.repositoryIds ?? [],
    }),
  };
}

const unavailableCandidateSource: RetrievalCandidateSource = {
  findCandidates: () =>
    Promise.resolve({ kind: 'unavailable', message: 'backend is offline' }),
};

const unsupportedCandidateSource: RetrievalCandidateSource = {
  findCandidates: () =>
    Promise.resolve({ kind: 'unsupported', operation: 'semantic-ranking' }),
};
