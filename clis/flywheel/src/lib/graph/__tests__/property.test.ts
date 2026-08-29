import { expect, test } from 'bun:test';

import { graphConstructionInputArbitrary } from '../../__tests__/arbitraries.js';
import { assert, fc, fastCheckParameters } from '../../__tests__/fast-check.js';
import { projectionSource } from '../../projection/__tests__/repository-fixture.js';
import { compileRepository } from '../../projection/compile.js';
import { buildRepositoryGraph } from '../build.js';
import type { GraphRelationship } from '../contract.js';
import { buildRepositoryGraphIndex } from '../indexes.js';

test('graph construction deduplicates generated duplicate and permuted inputs', async () => {
  const projection = await compileRepository(projectionSource().source);
  assert(
    fc.property(
      graphConstructionInputArbitrary({
        artifacts: projection.compilations.flatMap((compilation) =>
          compilation.kind === 'parsed' ? compilation.artifacts : []
        ),
        inventory: projection.inventory,
        resolutions: projection.resolutions,
      }),
      (input) => {
        const graph = buildRepositoryGraph(input);
        expect(graph).toEqual(projection.graph);
        expect(new Set(graph.relationships.map(semanticEdgeKey)).size).toBe(
          graph.relationships.length
        );
      }
    ),
    fastCheckParameters
  );
});

test('generated graph relationships have one forward and reverse index entry', async () => {
  const projection = await compileRepository(projectionSource().source);
  assert(
    fc.property(
      graphConstructionInputArbitrary({
        artifacts: projection.compilations.flatMap((compilation) =>
          compilation.kind === 'parsed' ? compilation.artifacts : []
        ),
        inventory: projection.inventory,
        resolutions: projection.resolutions,
      }),
      (input) => {
        const graph = buildRepositoryGraph(input);
        const index = buildRepositoryGraphIndex(graph);
        for (const relationship of graph.relationships) {
          expect(
            graph.relationships.filter(
              (candidate) =>
                semanticEdgeKey(candidate) === semanticEdgeKey(relationship)
            )
          ).toHaveLength(1);
          expect(
            index.outgoingByTarget
              .get(relationship.from)
              ?.filter((candidate) => candidate === relationship)
          ).toHaveLength(1);
          expect(
            index.incomingByTarget
              .get(relationship.to)
              ?.filter((candidate) => candidate === relationship)
          ).toHaveLength(1);
          expect(index.targetById.has(relationship.from)).toBe(true);
          expect(index.targetById.has(relationship.to)).toBe(true);
        }
      }
    ),
    fastCheckParameters
  );
});

function semanticEdgeKey(relationship: GraphRelationship): string {
  return [relationship.from, relationship.kind, relationship.to].join('|');
}
