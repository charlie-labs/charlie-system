import { expect, test } from 'bun:test';

import { targetId } from '../../../targets/id.js';
import { compileAndAssessRepository } from '../../../validation/assess.js';
import {
  createRetrievalScope,
  selectEligibleKnowledge,
} from '../eligibility.js';
import { projectKnowledge } from '../project.js';
import { corpusSource } from './corpus-fixture.js';

test('applies repository, lifecycle, and content-type eligibility explicitly', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const inventory = repository.projection.inventory;
  const defaultCorpus = selectEligibleKnowledge(source, inventory, scope());
  const customerWide = selectEligibleKnowledge(
    source,
    inventory,
    scope({ customerWideOnly: true })
  );
  const documents = selectEligibleKnowledge(
    source,
    inventory,
    scope({ contentTypes: ['document'] })
  );
  const includingInactive = selectEligibleKnowledge(
    source,
    inventory,
    scope({ includeNonActive: true })
  );

  expect(repository.validation.status).toBe('valid');
  expect(artifactNames(source, defaultCorpus.artifactIds)).toEqual([
    'customer-api',
    'Customer operations',
    'repository-api',
    'Repository operations',
  ]);
  expect(artifactNames(source, customerWide.artifactIds)).toEqual([
    'customer-api',
    'Customer operations',
  ]);
  expect(artifactNames(source, documents.artifactIds)).toEqual([
    'Customer operations',
    'Repository operations',
  ]);
  expect(artifactNames(source, includingInactive.artifactIds)).toEqual([
    'customer-api',
    'Customer operations',
    'repository-api',
    'Legacy operations',
    'Repository operations',
  ]);
  const admittedUnits = new Set(defaultCorpus.unitIds);
  expect(
    source.units.some(
      (unit) =>
        unit.authoredText.includes('Retained legacy') &&
        admittedUnits.has(unit.id)
    )
  ).toBe(false);
});

test('normalizes default scope and rejects an unknown selected Flywheel repository', async () => {
  const repository = await compileAndAssessRepository(corpusSource());
  const source = projectKnowledge(repository);
  const defaultScope = scope();

  expect(defaultScope).toEqual({
    contentTypes: ['document', 'catalog'],
    lifecycle: { kind: 'active-only' },
    repositories: { kind: 'customer-wide-and-all-repositories' },
  });
  expect(() =>
    selectEligibleKnowledge(
      source,
      repository.projection.inventory,
      scope({ repositoryIds: ['acme/missing'] })
    )
  ).toThrow('selected Flywheel repository does not exist: acme/missing');
});

function scope(
  overrides: Partial<{
    readonly contentTypes: readonly ('catalog' | 'document')[];
    readonly customerWideOnly: boolean;
    readonly includeNonActive: boolean;
    readonly repositoryIds: readonly string[];
  }> = {}
) {
  return createRetrievalScope({
    contentTypes: overrides.contentTypes ?? [],
    customerWideOnly: overrides.customerWideOnly ?? false,
    includeNonActive: overrides.includeNonActive ?? false,
    repositoryIds: overrides.repositoryIds ?? [],
  });
}

function artifactNames(
  source: ReturnType<typeof projectKnowledge>,
  artifactIds: readonly string[]
): readonly string[] {
  const selected = new Set(artifactIds);
  return source.artifacts.flatMap((artifact) => {
    if (!selected.has(targetId(artifact.target))) return [];
    return [artifact.kind === 'document' ? artifact.title : artifact.name];
  });
}
