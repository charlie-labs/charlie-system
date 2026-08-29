import { afterEach, expect, test } from 'bun:test';

import { targetId } from '../targets/id.js';
import { compileAndAssessRepository } from '../validation/assess.js';
import {
  cleanupReferenceRepositories,
  referenceRepository,
} from './fixtures/reference-repository.js';

afterEach(cleanupReferenceRepositories);

test('keeps unresolved, ambiguous, duplicate, and secret references explicit', async () => {
  const [unresolved, ambiguous, duplicate, secret] =
    await compileEdgeCaseRepositories();

  expectUnresolvedReference(unresolved);
  expectAmbiguousReference(ambiguous);
  expectDuplicateReference(duplicate);
  expect(diagnosticRuleIds(secret.validation.diagnostics)).toContain(
    'FW-ARTIFACT-REFERENCE-SECRET'
  );
  expect(JSON.stringify(secret)).not.toContain('FIXTURE-SECRET-ONLY');
});

type CompiledRepository = Awaited<
  ReturnType<typeof compileAndAssessRepository>
>;

function expectUnresolvedReference(repository: CompiledRepository): void {
  const resolution = repository.projection.resolutions.find(
    (candidate) =>
      candidate.authored.raw === 'component:default/missing' &&
      candidate.authored.source.path === 'customer-wide/docs/unresolved.md'
  );
  expect(resolution).toMatchObject({
    authored: { raw: 'component:default/missing' },
    kind: 'unresolved',
    reason: 'unknown-target',
    sourceTarget: {
      kind: 'document',
      path: 'customer-wide/docs/unresolved.md',
    },
  });
  if (resolution?.kind !== 'unresolved') return;
  expect(resolution.candidates ?? []).toEqual([]);
  expect(
    repository.projection.graph.relationships.filter(
      (relationship) =>
        relationship.from === targetId(resolution.sourceTarget) &&
        relationship.provenance.kind === 'authored' &&
        relationship.provenance.reference.raw === 'component:default/missing'
    )
  ).toEqual([]);
}

function expectAmbiguousReference(repository: CompiledRepository): void {
  const resolution = repository.projection.resolutions.find(
    (candidate) =>
      candidate.authored.raw === 'release-review' &&
      candidate.authored.source.path === 'customer-wide/docs/ambiguous.md'
  );
  expect(resolution).toMatchObject({
    authored: { raw: 'release-review' },
    kind: 'unresolved',
    reason: 'ambiguous-target',
  });
  if (resolution?.kind !== 'unresolved') return;
  expect(
    resolution.candidates?.map((candidate) => targetId(candidate))
  ).toEqual([
    'daemon:customer-wide%2F.agents%2Fdaemons%2Frelease-review%2FDAEMON.md',
    'skill:customer-wide%2F.agents%2Fskills%2Frelease-review%2FSKILL.md',
  ]);
  expect(
    repository.projection.graph.relationships.filter(
      (relationship) =>
        relationship.from === targetId(resolution.sourceTarget) &&
        relationship.provenance.kind === 'authored' &&
        relationship.provenance.reference.raw === 'release-review'
    )
  ).toEqual([]);
}

function expectDuplicateReference(repository: CompiledRepository): void {
  const duplicateArtifacts = repository.projection.compilations
    .flatMap((compilation) =>
      compilation.kind === 'parsed' ? compilation.artifacts : []
    )
    .filter(
      (artifact) =>
        targetId(artifact.target) === 'catalog:component%3Adefault%2Fapi'
    );
  expect(duplicateArtifacts.map((artifact) => artifact.path)).toEqual([
    'customer-wide/catalog/duplicate.yaml',
    'customer-wide/catalog/entities.yaml',
  ]);
  const resolution = repository.projection.resolutions.find(
    (candidate) => candidate.authored.raw === 'component:default/api'
  );
  expect(resolution).toMatchObject({
    authored: { raw: 'component:default/api' },
    kind: 'resolved',
    target: {
      entityKind: 'component',
      name: 'api',
      namespace: 'default',
    },
  });
  expect(
    repository.projection.graph.relationships.filter(
      (relationship) =>
        relationship.provenance.kind === 'authored' &&
        relationship.provenance.reference.raw === 'component:default/api'
    )
  ).toHaveLength(1);
}

async function compileEdgeCaseRepositories() {
  const [unresolved, ambiguous, duplicate, secret] = await Promise.all([
    referenceRepository({ overlay: 'unresolved' }),
    referenceRepository({ overlay: 'ambiguous' }),
    referenceRepository({ overlay: 'duplicate' }),
    referenceRepository({ overlay: 'secret' }),
  ]);
  return Promise.all([
    compileAndAssessRepository(unresolved.source),
    compileAndAssessRepository(ambiguous.source),
    compileAndAssessRepository(duplicate.source),
    compileAndAssessRepository(secret.source),
  ]);
}

function diagnosticRuleIds(
  diagnostics: readonly { readonly ruleId: string }[]
): readonly string[] {
  return diagnostics.map((diagnostic) => diagnostic.ruleId);
}
