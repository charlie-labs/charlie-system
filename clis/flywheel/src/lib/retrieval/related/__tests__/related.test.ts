import { expect, test } from 'bun:test';

import { projectionSource } from '../../../projection/__tests__/repository-fixture.js';
import { compileRepository } from '../../../projection/compile.js';
import { buildRepositoryIndexes } from '../../../projection/indexes.js';
import { retrieveRelated } from '../execute.js';
import { findRelatedTargets } from '../related.js';

test('traverses relationships through prebuilt adjacency indexes', async () => {
  const projection = await compileRepository(projectionSource().source);
  const indexes = buildRepositoryIndexes(projection);

  const result = findRelatedTargets(indexes, 'customer-wide/docs/guide.md');

  expect(result.kind).toBe('related');
  if (result.kind !== 'related') return;
  expect(result.target.id).toBe('document:customer-wide%2Fdocs%2Fguide.md');
  expect(
    result.relationships.map((relationship) => ({
      direction: relationship.direction,
      kind: relationship.kind,
      target: relationship.target.id,
    }))
  ).toContainEqual({
    direction: 'outgoing',
    kind: 'about',
    target: 'catalog:component%3Adefault%2Fapi',
  });
  expect(
    result.relationships.some(
      (relationship) =>
        relationship.direction === 'outgoing' &&
        relationship.kind === 'supersedes' &&
        relationship.target.id === 'document:customer-wide%2Fdocs%2Fold.md'
    )
  ).toBe(true);
});

test('preserves canonical direction for incoming and outgoing neighbors', async () => {
  const projection = await compileRepository(projectionSource().source);
  const indexes = buildRepositoryIndexes(projection);

  const result = findRelatedTargets(indexes, 'component:default/api');

  expect(result.kind).toBe('related');
  if (result.kind !== 'related') return;
  expect(
    result.relationships.map((relationship) => ({
      direction: relationship.direction,
      kind: relationship.kind,
      target: relationship.target.id,
    }))
  ).toEqual([
    {
      direction: 'outgoing',
      kind: 'owned-by',
      target: 'catalog:group%3Adefault%2Fplatform',
    },
    {
      direction: 'incoming',
      kind: 'about',
      target: 'document:customer-wide%2Fdocs%2Fguide.md',
    },
  ]);
});

test('returns external neighbors without settling external-target input', async () => {
  const projection = await compileRepository(projectionSource().source);
  const indexes = buildRepositoryIndexes(projection);

  const result = findRelatedTargets(indexes, 'customer-wide/docs/guide.md');

  expect(result.kind).toBe('related');
  if (result.kind !== 'related') return;
  expect(
    result.relationships.some(
      (relationship) =>
        relationship.direction === 'outgoing' &&
        relationship.kind === 'cites' &&
        relationship.target.id === 'linear:BOT-42'
    )
  ).toBe(true);
  expect(findRelatedTargets(indexes, 'linear:BOT-42')).toMatchObject({
    kind: 'unsupported-target',
    target: { target: { issueId: 'BOT-42', kind: 'linear' } },
  });
});

test('keeps ambiguous and missing lookups explicit', async () => {
  const projection = await compileRepository(projectionSource().source);
  const indexes = buildRepositoryIndexes(projection);

  expect(
    findRelatedTargets(indexes, 'customer-wide/catalog/entities.yaml')
  ).toMatchObject({
    candidates: [
      { target: { kind: 'catalog', name: 'api' } },
      { target: { kind: 'catalog', name: 'platform' } },
    ],
    kind: 'ambiguous',
  });
  expect(findRelatedTargets(indexes, 'missing')).toEqual({
    input: 'missing',
    kind: 'missing',
  });
});

test('composes one listing and one batch read without reparsing for traversal', async () => {
  const fixture = projectionSource();

  const result = await retrieveRelated({
    source: fixture.source,
    target: 'customer-wide/docs/guide.md',
  });

  expect(result.kind).toBe('related');
  expect(fixture.observation.listCalls).toBe(1);
  expect(fixture.observation.readCalls).toBe(1);
});
