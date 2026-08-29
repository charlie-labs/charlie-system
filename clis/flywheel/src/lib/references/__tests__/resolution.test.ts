import { expect, test } from 'bun:test';

import { artifactExamples } from '../../artifacts/__tests__/artifact-fixtures.js';
import type { CompiledArtifacts } from '../../artifacts/compiler/contract.js';
import type {
  ArtifactCompilation,
  ArtifactEntry,
  FlywheelArtifact,
} from '../../artifacts/contract.js';
import type {
  RepositoryEntry,
  RepositoryInventory,
} from '../../repository/contract.js';
import { sourceLocation } from '../../repository/location.js';
import { documentSectionTarget, documentTarget } from '../../targets/id.js';
import type { AuthoredReference, ReferenceResolution } from '../contract.js';
import { buildReferenceIndex } from '../index.js';
import { resolveReferences } from '../resolve.js';

const repositoryState = {
  kind: 'working-tree' as const,
  repositoryPath: '/knowledge',
};

test('resolves internal, support, and external references through a prebuilt index', () => {
  const fixture = referenceFixture();
  const index = buildReferenceIndex(fixture);
  const resolutions = resolveReferences({
    artifacts: fixture.compiled.artifacts,
    index,
  });

  expect(resolved(resolutions, 'Component:DEFAULT/API').target).toMatchObject({
    kind: 'catalog',
    name: 'api',
  });
  expect(resolved(resolutions, './other.md#Details').target).toMatchObject({
    anchor: 'details',
    kind: 'document-section',
  });
  expect(resolved(resolutions, './assets/diagram.png').target).toEqual({
    kind: 'support-resource',
    path: 'customer-wide/docs/assets/diagram.png',
  });
  expect(resolved(resolutions, 'release-manager').target.kind).toBe('role');
  expect(
    resolved(resolutions, 'https://linear.app/acme/issue/BOT-42/x').target
  ).toEqual({ issueId: 'BOT-42', kind: 'linear' });
});

test('preserves unresolved and ambiguous authored evidence', () => {
  const fixture = referenceFixture();
  const resolutions = resolveReferences({
    artifacts: fixture.compiled.artifacts,
    index: buildReferenceIndex(fixture),
  });

  expect(unresolved(resolutions, 'release-review')).toMatchObject({
    candidates: [
      { kind: 'daemon', daemonId: 'release-review' },
      { kind: 'skill', name: 'release-review' },
    ],
    reason: 'ambiguous-target',
  });
  expect(unresolved(resolutions, 'component:default/missing')).toMatchObject({
    reason: 'unknown-target',
  });
  expect(unresolved(resolutions, '../../../../escape.md')).toMatchObject({
    reason: 'invalid-syntax',
  });
  expect(unresolved(resolutions, 'file:///tmp/source')).toMatchObject({
    reason: 'unsupported-target',
  });
  expect(
    unresolved(resolutions, 'component:default/missing').authored.raw
  ).toBe('component:default/missing');
});

function referenceFixture(): Readonly<{
  readonly compiled: CompiledArtifacts;
  readonly inventory: RepositoryInventory;
}> {
  const examples = artifactExamples();
  const guide = documentArtifact(examples);
  const other = otherDocument(guide);
  const artifacts: readonly FlywheelArtifact[] = [
    ...examples.map((artifact) => artifactWithReferences(artifact)),
    other,
  ];
  const compilations = artifacts.map((artifact) => parsedCompilation(artifact));
  const support = supportEntry('customer-wide/docs/assets/diagram.png');
  return {
    compiled: { artifacts, compilations, state: repositoryState },
    inventory: {
      directories: [],
      entries: [...compilations.map((item) => item.entry), support],
      repositories: [],
      state: repositoryState,
    },
  };
}

function guideReferences(): readonly AuthoredReference[] {
  const path = 'customer-wide/docs/guide.md';
  return [
    reference(path, 'Component:DEFAULT/API', 'about'),
    reference(path, './other.md#Details', 'links-to'),
    reference(path, './assets/diagram.png', 'links-to'),
    reference(path, 'release-review', 'links-to'),
    reference(path, 'component:default/missing', 'about'),
    reference(path, '../../../../escape.md', 'links-to'),
    reference(path, 'file:///tmp/source', 'links-to'),
    reference(path, 'https://linear.app/acme/issue/BOT-42/x', 'cites'),
  ];
}

function artifactWithReferences(artifact: FlywheelArtifact): FlywheelArtifact {
  if (artifact.kind === 'document') {
    return { ...artifact, authoredReferences: guideReferences() };
  }
  if (artifact.kind === 'daemon') {
    return {
      ...artifact,
      authoredReferences: [
        reference(artifact.path, 'release-manager', 'contributes-to'),
      ],
    };
  }
  return artifact;
}

function otherDocument(
  template: Extract<FlywheelArtifact, { readonly kind: 'document' }>
): Extract<FlywheelArtifact, { readonly kind: 'document' }> {
  const path = 'customer-wide/docs/other.md';
  const target = documentTarget(path);
  const templateSection = template.sections[0];
  if (templateSection === undefined) {
    throw new Error('document section fixture is missing');
  }
  return {
    ...template,
    authoredReferences: [],
    path,
    sections: [
      {
        ...templateSection,
        heading: 'Details',
        headingPath: ['Details'],
        target: documentSectionTarget(target, 'details'),
      },
    ],
    source: sourceLocation(path, { column: 1, line: 1 }),
    target,
    title: 'Other',
  };
}

function documentArtifact(
  artifacts: readonly FlywheelArtifact[]
): Extract<FlywheelArtifact, { readonly kind: 'document' }> {
  const artifact = artifacts.find((candidate) => candidate.kind === 'document');
  if (artifact === undefined) {
    throw new Error('document fixture is missing');
  }
  return artifact;
}

function parsedCompilation(
  artifact: FlywheelArtifact
): Extract<ArtifactCompilation, { readonly kind: 'parsed' }> {
  return {
    artifacts: [artifact],
    entry: artifactEntry(artifact),
    kind: 'parsed',
    problems: [],
  };
}

function artifactEntry(artifact: FlywheelArtifact): ArtifactEntry {
  return {
    artifactKind: artifact.kind,
    kind: 'artifact',
    path: artifact.path,
    region: artifact.region,
  };
}

function supportEntry(path: string): RepositoryEntry {
  return {
    artifactKind: 'document',
    kind: 'support-file',
    path,
    region: { kind: 'customer-wide' },
  };
}

function reference(
  path: string,
  raw: string,
  relationship: AuthoredReference['relationship']
): AuthoredReference {
  return {
    raw,
    relationship,
    source: sourceLocation(path, { column: 1, line: 3 }),
  };
}

function resolved(
  resolutions: readonly ReferenceResolution[],
  raw: string
): Extract<ReferenceResolution, { readonly kind: 'resolved' }> {
  const result = resolutions.find(
    (candidate) =>
      candidate.authored.raw === raw && candidate.kind === 'resolved'
  );
  if (result === undefined || result.kind !== 'resolved') {
    throw new Error(`resolved reference fixture is missing: ${raw}`);
  }
  return result;
}

function unresolved(
  resolutions: readonly ReferenceResolution[],
  raw: string
): Extract<ReferenceResolution, { readonly kind: 'unresolved' }> {
  const result = resolutions.find(
    (candidate) =>
      candidate.authored.raw === raw && candidate.kind === 'unresolved'
  );
  if (result === undefined || result.kind !== 'unresolved') {
    throw new Error(`unresolved reference fixture is missing: ${raw}`);
  }
  return result;
}
