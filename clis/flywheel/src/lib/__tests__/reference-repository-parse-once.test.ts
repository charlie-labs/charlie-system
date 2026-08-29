import { afterEach, expect, mock, spyOn, test } from 'bun:test';

import { renderArtifactInspection } from '../../cli/output/artifact.js';
import { renderRelatedResult } from '../../cli/output/related.js';
import { buildRepositoryIndexes } from '../projection/indexes.js';
import {
  createRetrievalScope,
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../retrieval/corpus/eligibility.js';
import { projectKnowledge } from '../retrieval/corpus/project.js';
import { inspectCompiledArtifact } from '../retrieval/inspection/inspect.js';
import { findRelatedTargets } from '../retrieval/related/related.js';
import { compileAndAssessRepository } from '../validation/assess.js';
import {
  cleanupReferenceRepositories,
  referenceRepository,
} from './fixtures/reference-repository.js';

afterEach(async () => {
  mock.restore();
  await cleanupReferenceRepositories();
});

test('dispatches each accepted artifact once across indexing, validation, retrieval, inspection, and rendering', async () => {
  const fixture = await referenceRepository();
  const artifactDispatch = await import('../artifacts/dispatch.js');
  const parseSpy = spyOn(artifactDispatch, 'parseArtifact');
  const repository = await compileAndAssessRepository(fixture.source);
  const source = projectKnowledge(repository);
  const activeScope = createRetrievalScope({
    contentTypes: [],
    customerWideOnly: false,
    includeNonActive: false,
    repositoryIds: [],
  });
  const active = selectEligibleKnowledge(
    source,
    repository.projection.inventory,
    activeScope
  );
  const eligible = materializeEligibleKnowledge(source, active);
  const indexes = buildRepositoryIndexes(repository.projection);
  const compiled = {
    artifacts: repository.projection.compilations.flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    ),
    compilations: repository.projection.compilations,
    state: repository.projection.source,
  };
  const inspection = inspectCompiledArtifact(
    compiled,
    'customer-wide/docs/release-guide.md'
  );
  const related = findRelatedTargets(
    indexes,
    'customer-wide/docs/release-guide.md'
  );

  expect(eligible.units.length).toBeGreaterThan(0);
  expect(inspection.kind).toBe('artifact');
  expect(related.kind).toBe('related');
  if (inspection.kind === 'artifact') {
    expect(renderArtifactInspection(inspection)).toContain('Release guide');
  }
  if (related.kind === 'related') {
    expect(renderRelatedResult(related)).toContain('outgoing about');
  }

  const parsedPaths = parseSpy.mock.calls.map(([input]) => input.entry.path);
  const acceptedPaths = repository.projection.compilations.map(
    (compilation) => compilation.entry.path
  );
  expect(parseSpy).toHaveBeenCalledTimes(acceptedPaths.length);
  expect(parsedPaths).toEqual(acceptedPaths);
  expect(new Set(parsedPaths).size).toBe(parsedPaths.length);
});
