import { expect, test } from 'bun:test';

import type { RepositorySelection } from '../repository/contract.js';
import type { KnowledgeSourceUnit } from '../retrieval/corpus/contract.js';

test('keeps invalid public contract shapes rejected at compile time', () => {
  const invalidSelection: RepositorySelection = {
    kind: 'customer-wide-and-all-repositories',
    // @ts-expect-error customer-wide-and-all-repositories has no repository list
    repositories: ['acme/api'],
  };
  const invalidUnit: KnowledgeSourceUnit = {
    artifact: 'document:fixture',
    authoredText: 'Fixture text.',
    citationKeys: [],
    headingPath: ['Fixture'],
    id: 'fixture-unit',
    source: {
      end: { column: 1, line: 1 },
      path: 'customer-wide/docs/fixture.md',
      start: { column: 1, line: 1 },
    },
    // @ts-expect-error structural kinds are a closed public union
    structuralKind: 'unknown',
  };

  expect(invalidSelection.kind).toBe('customer-wide-and-all-repositories');
  expect(invalidUnit.artifact).toBe('document:fixture');
});
