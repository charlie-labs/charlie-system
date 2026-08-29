import { expect, test } from 'bun:test';

import { projectionSource } from '../../projection/__tests__/repository-fixture.js';
import { compileRepository } from '../../projection/compile.js';
import type { GraphRelationship } from '../contract.js';

test('builds explicit authored and structural relationships with provenance', async () => {
  const projection = await compileRepository(projectionSource().source);
  const relationships = projection.graph.relationships;

  expect(
    relationship(relationships, {
      from: 'document:customer-wide%2Fdocs%2Fguide.md',
      kind: 'about',
      to: 'catalog:component%3Adefault%2Fapi',
    }).provenance
  ).toMatchObject({
    kind: 'authored',
    reference: { raw: 'component:default/api' },
  });
  expect(
    relationship(relationships, {
      from: 'document-section:customer-wide%2Fdocs%2Fguide.md#guide',
      kind: 'links-to',
      to: 'document-section:customer-wide%2Fdocs%2Fother.md#details',
    }).provenance
  ).toMatchObject({
    kind: 'authored',
    reference: { label: 'replacedBy', relationship: 'links-to' },
  });
  expect(
    relationship(relationships, {
      from: 'document-section:customer-wide%2Fdocs%2Fguide.md#guide',
      kind: 'cites',
      to: 'github:acme%2Fapi:pull-request:7',
    }).provenance
  ).toMatchObject({ reference: { citationKey: 'proof' } });
  const linearCitation = relationship(relationships, {
    from: 'document:customer-wide%2Fdocs%2Fguide.md',
    kind: 'cites',
    to: 'linear:BOT-42',
  });
  if (linearCitation.provenance.kind !== 'authored') {
    throw new Error('Linear citation provenance is not authored');
  }
  expect(linearCitation.provenance.reference.raw).toContain('linear.app');
  expect(
    relationship(relationships, {
      from: 'document:customer-wide%2Fdocs%2Fguide.md',
      kind: 'supersedes',
      to: 'document:customer-wide%2Fdocs%2Fold.md',
    }).provenance
  ).toMatchObject({
    reference: {
      label: 'replacedBy',
      origin: 'document.replacedBy',
    },
  });
  expect(
    relationship(relationships, {
      from: 'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
      kind: 'contributes-to',
      to: 'role:release-manager',
    }).provenance
  ).toMatchObject({ kind: 'authored' });
});

test('adds deterministic containment facts for sections and support resources', async () => {
  const projection = await compileRepository(projectionSource().source);
  const relationships = projection.graph.relationships;

  expect(
    relationship(relationships, {
      from: 'document:customer-wide%2Fdocs%2Fguide.md',
      kind: 'contains',
      to: 'document-section:customer-wide%2Fdocs%2Fguide.md#sources',
    }).provenance
  ).toMatchObject({
    kind: 'structural',
    rule: 'document-contains-section',
  });
  const sharedSupport =
    'support-resource:customer-wide%2Fdocs%2Fassets%2Fdiagram.png';
  expect(
    projection.graph.targets.filter((record) => record.id === sharedSupport)
  ).toEqual([
    {
      id: sharedSupport,
      target: {
        kind: 'support-resource',
        path: 'customer-wide/docs/assets/diagram.png',
      },
    },
  ]);
  expect(
    relationships.filter(
      (candidate) =>
        candidate.kind === 'contains' && candidate.to === sharedSupport
    )
  ).toEqual([]);
  expect(
    relationships.filter(
      (candidate) =>
        candidate.kind === 'links-to' && candidate.to === sharedSupport
    )
  ).toHaveLength(2);

  const ownedSupport =
    'support-resource:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FCHECKLIST.md';
  const containment = relationships.filter(
    (candidate) =>
      candidate.from ===
        'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md' &&
      candidate.kind === 'contains' &&
      candidate.to === ownedSupport
  );
  expect(containment).toHaveLength(1);
  expect(containment[0]?.provenance).toMatchObject({
    kind: 'structural',
    rule: 'artifact-contains-support-resource',
  });
  expect(
    relationships.filter(
      (candidate) =>
        candidate.kind === 'links-to' && candidate.to === ownedSupport
    )
  ).toHaveLength(1);
});

function relationship(
  relationships: readonly GraphRelationship[],
  expected: Readonly<{
    readonly from: string;
    readonly kind: GraphRelationship['kind'];
    readonly to: string;
  }>
): GraphRelationship {
  const found = relationships.find(
    (candidate) =>
      candidate.from === expected.from &&
      candidate.kind === expected.kind &&
      candidate.to === expected.to
  );
  if (found === undefined) {
    throw new Error(
      `relationship fixture is missing: ${expected.from} ${expected.kind} ${expected.to}`
    );
  }
  return found;
}
