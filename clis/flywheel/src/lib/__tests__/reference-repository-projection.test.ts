import { afterEach, expect, test } from 'bun:test';

import { compileRepository } from '../projection/compile.js';
import { projectKnowledge } from '../retrieval/corpus/project.js';
import { targetId } from '../targets/id.js';
import { compileAndAssessRepository } from '../validation/assess.js';
import {
  cleanupReferenceRepositories,
  referenceRepository,
} from './fixtures/reference-repository.js';
import {
  entryAt,
  expectAuthoredReferences,
  expectCanonicalRelationships,
  expectCanonicalResolutions,
  expectDocumentStructures,
  expectParsedArtifacts,
  expectSourceUnits,
} from './reference-repository-projection-assertions.js';

afterEach(cleanupReferenceRepositories);

test('discovers every governed region and compiles the reference repository once', async () => {
  const fixture = await referenceRepository();
  const projection = await compileRepository(fixture.source);
  const manifest = fixture.manifest;

  expect(projection.inventory.directories).toEqual(manifest.directories);
  expect(projection.inventory.repositories).toEqual(manifest.repositories);
  expect(fixture.observation.listCalls).toBe(1);
  expect(fixture.observation.readCalls).toBe(1);
  expect(fixture.observation.readPaths).toHaveLength(1);

  const readPaths = fixture.observation.readPaths[0] ?? [];
  expect(new Set(readPaths).size).toBe(readPaths.length);
  expect(readPaths).toEqual(
    projection.compilations.map((compilation) => compilation.entry.path)
  );
  expect(readPaths).not.toContain(
    'customer-wide/docs/assets/release-diagram.png'
  );
  expect(readPaths).not.toContain('.flywheel/index.sqlite');
  expect(readPaths).not.toContain('.flywheel/reviews.yaml');

  for (const expectation of manifest.classifications) {
    const entry = entryAt(projection.inventory.entries, expectation.path);
    expect(entry).toMatchObject(expectation.expected);
  }
  expect(projection.inventory.entries).toHaveLength(
    manifest.classifications.length
  );
  expect(
    new Set(projection.inventory.entries.map((entry) => entry.path))
  ).toEqual(
    new Set(manifest.classifications.map((expectation) => expectation.path))
  );
  expect(
    new Set(
      projection.compilations.map((compilation) => compilation.entry.path)
    )
  ).toEqual(new Set(manifest.parsedArtifacts.map((artifact) => artifact.path)));

  const artifacts = projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );
  const artifactKeys = artifacts.map((artifact) => targetId(artifact.target));
  expect(new Set(artifactKeys).size).toBe(artifactKeys.length);
});

test('asserts typed parsed artifacts, locations, authored references, and source structures', async () => {
  const fixture = await referenceRepository();
  const projection = await compileRepository(fixture.source);
  const artifacts = projection.compilations.flatMap((compilation) =>
    compilation.kind === 'parsed' ? compilation.artifacts : []
  );

  expectParsedArtifacts(artifacts, fixture.manifest.parsedArtifacts);
  expectAuthoredReferences(artifacts, fixture.manifest.authoredReferences);
  expectDocumentStructures(artifacts);

  const source = projectKnowledge(
    await compileAndAssessRepository(fixture.source)
  );
  expectSourceUnits(source, fixture.manifest.sourceUnits);
});

test('resolves the connected graph without hiding external or structural provenance', async () => {
  const fixture = await referenceRepository();
  const projection = await compileRepository(fixture.source);

  expect(projection.resolutions).toHaveLength(
    fixture.manifest.resolvedReferences.length
  );
  expect(
    projection.resolutions.every((resolution) => resolution.kind === 'resolved')
  ).toBe(true);
  expectCanonicalResolutions(
    projection.resolutions,
    fixture.manifest.resolvedReferences
  );
  expect(projection.graph.relationships).toHaveLength(
    fixture.manifest.relationships.length
  );
  expectCanonicalRelationships(
    projection.graph.relationships,
    fixture.manifest.relationships
  );
});
