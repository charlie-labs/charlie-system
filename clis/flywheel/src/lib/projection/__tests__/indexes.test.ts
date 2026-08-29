import { expect, test } from 'bun:test';

import { compileRepository } from '../compile.js';
import { buildRepositoryIndexes } from '../indexes.js';
import { projectionSource } from './repository-fixture.js';

test('derives replaceable artifact, alias, target, and adjacency indexes', async () => {
  const projection = await compileRepository(projectionSource().source);
  const indexes = buildRepositoryIndexes(projection);
  const guide = 'document:customer-wide%2Fdocs%2Fguide.md';
  const guideSection = 'document-section:customer-wide%2Fdocs%2Fguide.md#guide';

  expect(indexes.aliases.get('customer-wide/docs/guide.md')).toEqual([guide]);
  expect(indexes.aliases.get('customer-wide/catalog/entities.yaml')).toEqual([
    'catalog:component%3Adefault%2Fapi',
    'catalog:group%3Adefault%2Fplatform',
  ]);
  expect(
    indexes.aliases.get('https://linear.app/acme/issue/BOT-42/tracking')
  ).toEqual(['linear:BOT-42']);
  expect(indexes.artifactByTarget.get(guideSection)).toMatchObject({
    kind: 'document',
    title: 'Guide',
  });
  expect(
    indexes.artifactsByPath.get('customer-wide/catalog/entities.yaml')
  ).toHaveLength(2);
  expect(indexes.graph.targetById.get('linear:BOT-42')).toEqual({
    issueId: 'BOT-42',
    kind: 'linear',
  });
  expect(indexes.graph.outgoingByTarget.get(guide)?.length).toBeGreaterThan(0);
  expect(indexes.graph.incomingByTarget.get('linear:BOT-42')).toHaveLength(1);
});
