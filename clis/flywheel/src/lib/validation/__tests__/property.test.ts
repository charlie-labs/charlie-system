import { expect, test } from 'bun:test';

import { assert, fc, fastCheckParameters } from '../../__tests__/fast-check.js';
import { compileRepository } from '../../projection/compile.js';
import type { RepositoryProjection } from '../../projection/contract.js';
import { buildRepositoryIndexes } from '../../projection/indexes.js';
import { validateRepository } from '../validate.js';
import { validationSource } from './repository-fixture.js';

test('validation diagnostics and status are deterministic under harmless ordering changes', async () => {
  const projection = await compileRepository(validationSource().source);
  const expected = validateRepository(
    projection,
    buildRepositoryIndexes(projection)
  );
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
      fc.shuffledSubarray([...projection.graph.relationships], {
        minLength: projection.graph.relationships.length,
        maxLength: projection.graph.relationships.length,
      }),
      (compilations, entries, relationships) => {
        const candidate: RepositoryProjection = {
          ...projection,
          compilations,
          graph: { ...projection.graph, relationships },
          inventory: { ...projection.inventory, entries },
        };
        expect(
          validateRepository(candidate, buildRepositoryIndexes(candidate))
        ).toEqual(expected);
      }
    ),
    fastCheckParameters
  );
});

test('validation keeps malformed and semantically invalid generated states explicit', async () => {
  const projection = await compileRepository(validationSource().source);
  assert(
    fc.property(fc.boolean(), (semanticInvalidity) => {
      const candidate: RepositoryProjection = semanticInvalidity
        ? {
            ...projection,
            inventory: {
              ...projection.inventory,
              entries: [
                ...projection.inventory.entries,
                {
                  kind: 'prohibited',
                  path: 'customer-wide/AGENTS.md',
                  region: { kind: 'customer-wide' },
                  rule: 'rules-are-not-flywheel-content',
                },
              ],
            },
          }
        : {
            ...projection,
            compilations: projection.compilations.slice(1),
          };
      const report = validateRepository(
        candidate,
        buildRepositoryIndexes(candidate)
      );

      expect(report.status).toBe(semanticInvalidity ? 'invalid' : 'incomplete');
      expect(report.diagnostics.length).toBeGreaterThan(0);
    }),
    fastCheckParameters
  );
});
