import { expect, test } from 'bun:test';

import type { RepositorySource } from '../../../repository/contract.js';
import { RepositorySourceError } from '../../../repository/errors.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import { retrieveKnowledge } from '../execute.js';
import { createLexicalCandidateSource } from '../lexical.js';

test('composes one source assessment into a ranked retrieval request', async () => {
  const result = await retrieveKnowledge({
    ...searchOptions,
    query: 'repository deployment',
    source: corpusSource(),
  });

  expect(result.kind).toBe('results');
  if (result.kind !== 'results') return;
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.context.repositorySelection).toEqual({
    kind: 'customer-wide-and-all-repositories',
  });
});

test('keeps source and selection failures explicit', async () => {
  const [unavailable, invalidSelection] = await Promise.all([
    retrieveKnowledge({
      ...searchOptions,
      query: 'deployment',
      source: unavailableSource,
    }),
    retrieveKnowledge({
      ...searchOptions,
      customerWideOnly: true,
      query: 'deployment',
      repositoryIds: ['acme/api'],
      source: corpusSource(),
    }),
  ]);

  expect(unavailable).toMatchObject({
    kind: 'unavailable',
    reason: 'repository-unavailable',
  });
  expect(invalidSelection).toEqual({
    kind: 'invalid-selection',
    message: '--customer-wide-only cannot be combined with --repo',
  });
});

const searchOptions = {
  artifactLimit: 5,
  candidateSource: createLexicalCandidateSource(),
  contentTypes: [],
  customerWideOnly: false,
  includeNonActive: false,
  passageLimitPerArtifact: 3,
  repositoryIds: [],
} as const;

const unavailableSource: RepositorySource = {
  listEntries: () =>
    Promise.reject(new RepositorySourceError('repository is unavailable')),
  readFiles: () => Promise.resolve([]),
  state: { kind: 'working-tree', repositoryPath: '/missing' },
};
