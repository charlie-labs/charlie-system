import { expect, test } from 'bun:test';

import type { RepositorySource } from '../../../repository/contract.js';
import { RepositorySourceError } from '../../../repository/errors.js';
import { validationSource } from '../../../validation/__tests__/repository-fixture.js';
import { corpusSource } from '../../corpus/__tests__/corpus-fixture.js';
import type { RetrievalCandidateSource } from '../candidate-source.js';
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

test('rejects request-owned invariants before repository or candidate work', async () => {
  const { observation, source } = validationSource();
  let candidateCalls = 0;
  const candidateSource: RetrievalCandidateSource = {
    findCandidates: () => {
      candidateCalls += 1;
      return Promise.resolve({ candidates: [], kind: 'candidates' });
    },
  };
  const [available, unavailable, invalidArtifactLimit, invalidPassageLimit] =
    await Promise.all([
      retrieveKnowledge({
        ...searchOptions,
        candidateSource,
        query: '   ',
        source,
      }),
      retrieveKnowledge({
        ...searchOptions,
        candidateSource,
        query: '   ',
        source: unavailableSource,
      }),
      retrieveKnowledge({
        ...searchOptions,
        artifactLimit: 0,
        candidateSource,
        query: 'deployment',
        source,
      }),
      retrieveKnowledge({
        ...searchOptions,
        candidateSource,
        passageLimitPerArtifact: 0,
        query: 'deployment',
        source,
      }),
    ]);

  expect(available).toEqual({
    kind: 'invalid-selection',
    message: 'search query must not be empty',
  });
  expect(unavailable).toEqual(available);
  expect(invalidArtifactLimit).toEqual({
    kind: 'invalid-selection',
    message: 'artifact result limit must be a positive integer',
  });
  expect(invalidPassageLimit).toEqual({
    kind: 'invalid-selection',
    message: 'passage result limit must be a positive integer',
  });
  expect(observation).toEqual({ listCalls: 0, readCalls: 0, readPaths: [] });
  expect(candidateCalls).toBe(0);
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
    Promise.reject(
      new RepositorySourceError('Flywheel repository is unavailable')
    ),
  readFiles: () => Promise.resolve([]),
  state: { kind: 'working-tree', repositoryPath: '/missing' },
};
