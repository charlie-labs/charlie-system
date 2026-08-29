import { expect, test } from 'bun:test';

import { graphFragmentArbitrary } from '../../__tests__/arbitraries.js';
import { assert, fc, fastCheckParameters } from '../../__tests__/fast-check.js';
import { projectionSource } from '../../projection/__tests__/repository-fixture.js';
import { compileRepository } from '../../projection/compile.js';
import { buildRepositoryGraph } from '../build.js';
import { buildRepositoryGraphIndex } from '../indexes.js';

test('graph construction is deterministic under artifact, source, and resolution permutations', async () => {
  const projection = await compileRepository(projectionSource().source);
  assert(
    fc.property(
      fc.shuffledSubarray([...projection.compilations], {
        minLength: projection.compilations.length,
        maxLength: projection.compilations.length,
      }),
      fc.shuffledSubarray([...projection.inventory.entries], {
        minLength: projection.inventory.entries.length,
        maxLength: projection.inventory.entries.length,
      }),
      fc.shuffledSubarray([...projection.resolutions], {
        minLength: projection.resolutions.length,
        maxLength: projection.resolutions.length,
      }),
      (compilations, entries, resolutions) => {
        const artifacts = compilations.flatMap((compilation) =>
          compilation.kind === 'parsed' ? compilation.artifacts : []
        );
        const graph = buildRepositoryGraph({
          artifacts,
          inventory: { ...projection.inventory, entries },
          resolutions,
        });
        expect(graph).toEqual(projection.graph);
      }
    ),
    fastCheckParameters
  );
});

test('graph relationships are unique and indexed in both directions', async () => {
  const projection = await compileRepository(projectionSource().source);
  const index = buildRepositoryGraphIndex(projection.graph);
  assert(
    fc.property(graphFragmentArbitrary(projection.graph), (relationship) => {
      const key = JSON.stringify(relationship);
      expect(
        projection.graph.relationships.filter(
          (candidate) => JSON.stringify(candidate) === key
        )
      ).toHaveLength(1);
      expect(index.outgoingByTarget.get(relationship.from)).toContainEqual(
        relationship
      );
      expect(index.incomingByTarget.get(relationship.to)).toContainEqual(
        relationship
      );
      expect(index.targetById.has(relationship.from)).toBe(true);
      expect(index.targetById.has(relationship.to)).toBe(true);
    }),
    fastCheckParameters
  );
});
