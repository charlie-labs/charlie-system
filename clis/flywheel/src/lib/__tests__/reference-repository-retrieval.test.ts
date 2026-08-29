import { afterEach, expect, test } from 'bun:test';

import type {
  RepositoryEntry,
  RepositorySource,
} from '../repository/contract.js';
import {
  createRetrievalScope,
  materializeEligibleKnowledge,
  selectEligibleKnowledge,
} from '../retrieval/corpus/eligibility.js';
import { projectKnowledge } from '../retrieval/corpus/project.js';
import { targetId } from '../targets/id.js';
import { compileAndAssessRepository } from '../validation/assess.js';
import {
  cleanupReferenceRepositories,
  referenceRepository,
} from './fixtures/reference-repository.js';
import { expectSourceUnits } from './reference-repository-source-assertions.js';

afterEach(cleanupReferenceRepositories);

test('validates lifecycle and source-faithful retrieval eligibility', async () => {
  const fixture = await referenceRepository();
  const repository = await compileAndAssessRepository(fixture.source);
  const source = projectKnowledge(repository);
  const inventory = repository.projection.inventory;
  const scopes = fixtureRetrievalScopes();
  const active = selectEligibleKnowledge(source, inventory, scopes.active);
  const customerWide = selectEligibleKnowledge(
    source,
    inventory,
    scopes.customerWide
  );
  const includingNonActive = selectEligibleKnowledge(
    source,
    inventory,
    scopes.includingNonActive
  );
  const repositoryOnly = selectEligibleKnowledge(
    source,
    inventory,
    scopes.repository
  );

  expect(repository.validation.status).toBe(fixture.manifest.validation.status);
  expect(
    repository.validation.diagnostics
      .map((diagnostic) => diagnostic.ruleId)
      .join('|')
  ).toBe(fixture.manifest.validation.diagnosticRuleIds.join('|'));
  expectRetrievalTitles(source, fixture, {
    active,
    customerWide,
    includingNonActive,
    repositoryOnly,
  });

  const eligible = materializeEligibleKnowledge(source, active);
  expect(
    eligible.units.some((unit) =>
      unit.authoredText.includes('deprecated release')
    )
  ).toBe(false);
  await expectSourceUnits(eligible.units, fixture.repositoryPath, [
    fixture.manifest.retrieval.activeDocumentUnit,
  ]);
});

test('keeps malformed and disappeared artifacts visible as incomplete', async () => {
  const malformed = await referenceRepository({ overlay: 'malformed' });
  const [malformedRepository, disappearedRepository] = await Promise.all([
    compileAndAssessRepository(malformed.source),
    compileAndAssessRepository(disappearedSource()),
  ]);

  expect(malformedRepository.validation.status).toBe('incomplete');
  expect(
    diagnosticRuleIds(malformedRepository.validation.diagnostics)
  ).toContain('FW-ARTIFACT-FRONTMATTER-REQUIRED');
  expect(disappearedRepository.validation.status).toBe('incomplete');
  expect(
    diagnosticRuleIds(disappearedRepository.validation.diagnostics)
  ).toContain('FW-ARTIFACT-SOURCE-MISSING');
});

test('keeps prohibited, unsupported, symlink, and special entries visible', async () => {
  const fixture = await referenceRepository({
    overlay: 'prohibited-unsupported',
  });
  const symlinkFixture = await referenceRepository({ overlay: 'symlink' });
  const [repository, symlinkRepository, specialRepository] = await Promise.all([
    compileAndAssessRepository(fixture.source),
    compileAndAssessRepository(symlinkFixture.source),
    compileAndAssessRepository(specialFileSource()),
  ]);
  const entries = repository.projection.inventory.entries;

  expect(repository.validation.status).toBe('invalid');
  for (const ruleId of [
    'FW-REPOSITORY-RULE-PROHIBITED',
    'FW-REPOSITORY-UNSUPPORTED',
  ]) {
    expect(diagnosticRuleIds(repository.validation.diagnostics)).toContain(
      ruleId
    );
  }
  expect(entryAt(entries, 'customer-wide/AGENTS.md')).toMatchObject({
    kind: 'prohibited',
    rule: 'rules-are-not-flywheel-content',
  });
  expect(
    entryAt(
      symlinkRepository.projection.inventory.entries,
      'customer-wide/docs/linked'
    )
  ).toMatchObject({ kind: 'unsupported', reason: 'symbolic-link' });
  expect(
    entryAt(
      specialRepository.projection.inventory.entries,
      'customer-wide/docs/socket'
    )
  ).toMatchObject({ kind: 'unsupported', reason: 'special-file' });
  expect(
    entryAt(entries, 'customer-wide/catalog/unsupported.txt')
  ).toMatchObject({
    kind: 'unsupported',
    reason: 'unsupported-file-type',
  });
});

test('rejects an invalid retrieval selection before repository work', async () => {
  const fixture = await referenceRepository();
  expect(() =>
    createRetrievalScope({
      contentTypes: [],
      customerWideOnly: true,
      includeNonActive: false,
      repositoryIds: ['acme/api'],
    })
  ).toThrow('--customer-wide-only cannot be combined with --repo');
  expect(fixture.observation).toEqual({
    listCalls: 0,
    readCalls: 0,
    readPaths: [],
  });
});

function fixtureRetrievalScopes() {
  return {
    active: createRetrievalScope({
      contentTypes: [],
      customerWideOnly: false,
      includeNonActive: false,
      repositoryIds: [],
    }),
    customerWide: createRetrievalScope({
      contentTypes: [],
      customerWideOnly: true,
      includeNonActive: false,
      repositoryIds: [],
    }),
    includingNonActive: createRetrievalScope({
      contentTypes: [],
      customerWideOnly: false,
      includeNonActive: true,
      repositoryIds: [],
    }),
    repository: createRetrievalScope({
      contentTypes: [],
      customerWideOnly: false,
      includeNonActive: false,
      repositoryIds: ['acme/api'],
    }),
  };
}

function artifactTitles(
  source: ReturnType<typeof projectKnowledge>,
  ids: readonly string[]
): readonly string[] {
  const selected = new Set(ids);
  return source.artifacts.flatMap((artifact) => {
    if (!selected.has(targetId(artifact.target))) return [];
    return [
      artifact.kind === 'document'
        ? artifact.title
        : (artifact.title ?? artifact.name),
    ];
  });
}

function expectRetrievalTitles(
  source: ReturnType<typeof projectKnowledge>,
  fixture: Awaited<ReturnType<typeof referenceRepository>>,
  selections: Readonly<{
    readonly active: ReturnType<typeof selectEligibleKnowledge>;
    readonly customerWide: ReturnType<typeof selectEligibleKnowledge>;
    readonly includingNonActive: ReturnType<typeof selectEligibleKnowledge>;
    readonly repositoryOnly: ReturnType<typeof selectEligibleKnowledge>;
  }>
): void {
  expect(artifactTitles(source, selections.active.artifactIds)).toEqual(
    fixture.manifest.retrieval.activeArtifactTitles
  );
  expect(artifactTitles(source, selections.customerWide.artifactIds)).toEqual(
    fixture.manifest.retrieval.customerWideArtifactTitles
  );
  expect(
    artifactTitles(source, selections.includingNonActive.artifactIds)
  ).toEqual(fixture.manifest.retrieval.includingNonActiveTitles);
  expect(artifactTitles(source, selections.repositoryOnly.artifactIds)).toEqual(
    fixture.manifest.retrieval.repositoryArtifactTitles
  );
}

function diagnosticRuleIds(
  diagnostics: readonly { readonly ruleId: string }[]
): readonly string[] {
  return diagnostics.map((diagnostic) => diagnostic.ruleId);
}

function entryAt(
  entries: readonly RepositoryEntry[],
  path: string
): RepositoryEntry | undefined {
  return entries.find((entry) => entry.path === path);
}

function disappearedSource(): RepositorySource {
  return {
    listEntries: () =>
      Promise.resolve([
        { kind: 'file', path: 'customer-wide/docs/disappeared.md' },
      ]),
    readFiles: () =>
      Promise.resolve([
        { kind: 'missing', path: 'customer-wide/docs/disappeared.md' },
      ]),
    state: { kind: 'working-tree', repositoryPath: '/disappeared-fixture' },
  };
}

function specialFileSource(): RepositorySource {
  return {
    listEntries: () =>
      Promise.resolve([{ kind: 'other', path: 'customer-wide/docs/socket' }]),
    readFiles: () => Promise.resolve([]),
    state: { kind: 'working-tree', repositoryPath: '/special-file-fixture' },
  };
}
